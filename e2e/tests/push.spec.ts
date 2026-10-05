import { LoginPage, SearchPage } from '../pages'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import { recordJmapTraffic } from '../support/jmapTraffic'

/** A date `minutes` before 2026-10-01 noon, as JMAP writes it */
function minutesBefore(minutes: number): string {
  return new Date(Date.UTC(2026, 9, 1, 12) - minutes * 60_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Creates emails in a mailbox at once, as delivered: `subject` and
 * `receivedAt` of each, one conversation each
 */
async function createEmails(
  jmap: JmapClient,
  mailboxRole: 'inbox' | 'trash',
  emails: readonly { subject: string; receivedAt: string }[]
): Promise<void> {
  const accountId = await jmap.accountId()
  const mailbox = await jmap.findMailboxByRole(mailboxRole)
  const create = Object.fromEntries(
    emails.map(({ subject, receivedAt }, index) => [
      `e${index}`,
      {
        mailboxIds: { [mailbox.id]: true },
        keywords: { $seen: true },
        from: [{ email: 'news@example.com' }],
        subject,
        receivedAt,
        textBody: [{ partId: 'text', type: 'text/plain' }],
        bodyValues: { text: { value: subject } }
      }
    ])
  )
  await jmap.request([['Email/set', { accountId, create }, 'c']])
}

/**
 * Scrolls the list down, half a screen at a time, until the row shows (the
 * rows are virtualized, and the order of the results is the server's)
 */
async function scrollToRow(
  list: import('@playwright/test').Locator,
  row: import('@playwright/test').Locator
): Promise<void> {
  await expect(async () => {
    await list.evaluate(element => {
      element.scrollTop += element.clientHeight / 2
    })
    await expect(row).toBeVisible({ timeout: 500 })
  }).toPass({ timeout: 20_000 })
}

test.describe('PUSH real-time updates', () => {
  test('PUSH-01 a new email appears live, then follows its read and star changes', async ({
    page,
    user,
    jmap
  }) => {
    const traffic = recordJmapTraffic(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emptyListView).toBeVisible()
    traffic.reset()

    await jmap.sendEmail({
      to: user.email,
      subject: 'pushed email',
      text: 'hi'
    })

    const row = mailbox.emailRow('pushed email')
    await expect(row).toHaveAttribute('data-unread', 'true')
    await expect(mailbox.emailRowStar('pushed email')).toHaveAttribute(
      'aria-pressed',
      'false'
    )

    const email = await jmap.waitForEmail({ subject: 'pushed email' })
    await jmap.setKeywords(email.id, { $seen: true })
    await expect(row).not.toHaveAttribute('data-unread')

    await jmap.setKeywords(email.id, { $flagged: true })
    await expect(mailbox.emailRowStar('pushed email')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // Incremental: the changes are fetched, the list is never queried again
    expect(traffic.methods()).toContain('Email/changes')
    expect(traffic.methods()).not.toContain('Email/query')
  })

  test('PUSH-02 an email entering below the loaded rows shows once, at its place, when scrolled to', async ({
    page,
    user,
    jmap
  }) => {
    // 70 conversations, one a minute: the list loads the first pages only
    await createEmails(
      jmap,
      'inbox',
      Array.from({ length: 70 }, (_, index) => ({
        subject: `Row ${String(index).padStart(2, '0')}`,
        receivedAt: minutesBefore(index)
      }))
    )
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('Row 00')).toBeVisible()
    await expect(mailbox.emailRow('Row 69')).toHaveCount(0)

    // Between "Row 64" and "Row 65", by push
    await createEmails(jmap, 'inbox', [
      { subject: 'Late arrival', receivedAt: minutesBefore(64.5) }
    ])
    await expect(mailbox.emailRow('Late arrival')).toHaveCount(0)

    await scrollToRow(mailbox.emailList, mailbox.emailRow('Late arrival'))
    await expect(mailbox.emailRow('Late arrival')).toHaveCount(1)
    await scrollToRow(mailbox.emailList, mailbox.emailRow('Row 69'))
    const subjects = await mailbox.emailSubjects()
    const index = subjects.indexOf('Late arrival')
    expect(subjects.slice(index - 1, index + 2)).toEqual([
      'Row 64',
      'Late arrival',
      'Row 65'
    ])
    expect(new Set(subjects).size).toBe(subjects.length)
  })

  test('PUSH-03 an email delivered before the push channel opens shows without user action', async ({
    page,
    user,
    jmap
  }) => {
    // The channel opens only once the email is delivered: its ticket
    // (com:linagora:params:jmap:ws:ticket) waits until then
    let openChannel = (): void => undefined
    const gate = new Promise<void>(resolve => {
      openChannel = resolve
    })
    await page.route('**/jmap/ws/ticket', async route => {
      await gate
      await route.continue()
    })
    await jmap.sendEmail({ to: user.email, subject: 'First one', text: 'hi' })
    await jmap.waitForEmail({ subject: 'First one' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('First one')).toBeVisible()

    await jmap.sendEmail({
      to: user.email,
      subject: 'Before the channel',
      text: 'hi'
    })
    await jmap.waitForEmail({ subject: 'Before the channel' })
    openChannel()

    await expect(mailbox.emailRow('Before the channel')).toBeVisible()
  })

  test('PUSH-04 during a grouped search, an email that cannot match queries nothing, the scroll stays', async ({
    page,
    user,
    jmap
  }) => {
    // 40 conversations: the memory image hangs the updates of the other
    // tests beyond 256 messages (linagora/tmail-backend#2684); more than 256
    // loaded rows are measured by PERF-05 (docs/perf/sync.md)
    await createEmails(
      jmap,
      'inbox',
      Array.from({ length: 40 }, (_, index) => ({
        subject: `Topic ${index}`,
        receivedAt: minutesBefore(index)
      }))
    )
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('Topic 0')).toBeVisible()
    await expect
      .poll(async () => (await jmap.queryEmails({ text: 'Topic' })).length)
      .toBe(40)
    const search = await new SearchPage(page).search('Topic')
    const results = search.resultRows()
    await expect(results.first()).toBeVisible()
    const list = page.getByTestId('email-list')
    await scrollToRow(list, mailbox.emailRow('Topic 39'))
    const before = await list.evaluate(element => ({
      top: element.scrollTop,
      height: element.scrollHeight
    }))
    const traffic = recordJmapTraffic(page)

    // In the Trash, which the search leaves out: nothing more than its
    // changes, the rows and the scroll stay
    await createEmails(jmap, 'trash', [
      { subject: 'Topic in the Trash', receivedAt: minutesBefore(-5) }
    ])
    await expect.poll(() => traffic.methods()).toContain('Email/changes')
    // Another one in the Inbox, which the client cannot tell: the results
    // are queried again, the loaded rows kept
    await createEmails(jmap, 'inbox', [
      { subject: 'Topic later', receivedAt: minutesBefore(-10) }
    ])
    await expect
      .poll(
        () =>
          traffic
            .requests()
            .filter(methods => methods.includes('Email/changes')).length
      )
      .toBe(2)
    await expect.poll(() => traffic.methods()).toContain('Email/query')
    const requests = traffic.requests()
    const firstQuery = requests.findIndex(methods =>
      methods.includes('Email/query')
    )
    // The first push asked for nothing more
    expect(
      requests
        .slice(0, firstQuery)
        .filter(methods => methods.includes('Email/changes'))
    ).toHaveLength(2)
    // The loaded rows and the scroll stayed (the results are sorted by
    // relevance; the memory index may not list the new email yet)
    await expect(mailbox.emailRow('Topic 39')).toBeVisible()
    const after = await list.evaluate(element => ({
      top: element.scrollTop,
      height: element.scrollHeight
    }))
    expect(after.top).toBe(before.top)
    expect(after.height).toBeGreaterThanOrEqual(before.height)
    await expect(mailbox.emailRow('Topic in the Trash')).toHaveCount(0)
  })
})
