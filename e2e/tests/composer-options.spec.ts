import { ConversationPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { JmapClient, MailboxRole } from '../support/jmap'

/**
 * The options of a message (read receipt, important), what the identity
 * adds to it (Reply-To, Bcc), the attachment reminder, and the keys of the
 * composer: what tmail-flutter sends, checked in the message received.
 */

const READ_RECEIPT = 'header:Disposition-Notification-To:asText'
const PRIORITY_HEADERS = [
  'header:X-Priority:asText',
  'header:Importance:asText',
  'header:Priority:asText'
] as const

interface Received {
  id: string
  subject: string
  keywords: Record<string, true>
  replyTo: { name: string | null; email: string }[] | null
  [header: string]: unknown
}

/** The emails of a mailbox with their options, newest first */
async function readMailbox(
  jmap: JmapClient,
  role: MailboxRole
): Promise<Received[]> {
  const accountId = await jmap.accountId()
  const mailbox = await jmap.findMailboxByRole(role)
  const [, got] = await jmap.request([
    [
      'Email/query',
      {
        accountId,
        filter: { inMailbox: mailbox.id },
        sort: [{ property: 'receivedAt', isAscending: false }]
      },
      'q'
    ],
    [
      'Email/get',
      {
        accountId,
        '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
        properties: [
          'subject',
          'keywords',
          'replyTo',
          READ_RECEIPT,
          ...PRIORITY_HEADERS
        ]
      },
      'g'
    ]
  ])
  return (got?.[1].list ?? []) as Received[]
}

async function received(
  jmap: JmapClient,
  subject: string,
  role: MailboxRole = 'inbox'
): Promise<Received> {
  await jmap.waitForEmail({ subject, mailboxRole: role })
  const found = (await readMailbox(jmap, role)).find(
    email => email.subject === subject
  )
  if (!found) throw new Error(`No "${subject}" in ${role}`)
  return found
}

test.describe('CMP composer: options of a message', () => {
  test(
    'CMP-02 a message marked important is received with its headers, flagged in the list',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.fill({
        to: [user.email],
        subject: 'Mark email as important',
        body: 'Mark email as important'
      })

      await composer.runMoreAction('mark-important')
      await expect(mailbox.toast).toContainText('Mark as important is enabled')
      await composer.moreButton.click()
      await expect(
        page.getByTestId('composer-mark-important-item')
      ).toHaveAttribute('aria-checked', 'true')
      await expectNoA11yViolations(page)
      await page.keyboard.press('Escape')
      await composer.send()

      const email = await received(jmap, 'Mark email as important')
      expect(email).toMatchObject({
        'header:X-Priority:asText': '1',
        'header:Importance:asText': 'high',
        'header:Priority:asText': 'urgent'
      })
      await expect(
        mailbox.emailRowImportantIcon('Mark email as important')
      ).toBeVisible()
      await expect(
        mailbox.emailRowLink('Mark email as important')
      ).toHaveAccessibleName(/Important/)
    }
  )

  test(
    'CMP-03 a read receipt asked is received; the reader asks until it is sent',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const subject = 'Receipt asked'
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.fill({ to: [user.email], subject, body: subject })

      await composer.runMoreAction('read-receipt')
      await expect(mailbox.toast).toContainText(
        'Request read receipt has been enabled'
      )
      await composer.send()
      const email = await received(jmap, subject)
      expect(email[READ_RECEIPT]).toBe(user.email)

      // Declined: nothing sent, asked again when opened again
      const dialog = page.getByTestId('confirm-dialog')
      for (const answer of ['No', 'Yes'] as const) {
        await mailbox.emailRow(subject).click()
        const conversation = await new ConversationPage(page).expectLoaded(
          subject
        )
        await expect(dialog).toContainText('Read receipt request')
        await expect(dialog).toContainText(
          'The sender has requested a Read receipt for this email. Send Read receipt?'
        )
        if (answer === 'No') {
          await expectNoA11yViolations(page)
          await dialog.getByRole('button', { name: 'No' }).click()
          await expect(dialog).toBeHidden()
          await conversation.backButton.click()
        } else {
          await dialog.getByRole('button', { name: 'Yes' }).click()
          await expect(mailbox.toast).toContainText(
            'A read receipt has been sent.'
          )
        }
      }

      // The receipt reaches the sender (the user), the email is $mdnsent
      await received(jmap, `Read: ${subject}`)
      expect((await received(jmap, subject)).keywords).toMatchObject({
        $mdnsent: true
      })
    }
  )

  test('CMP-04 the attachment reminder ignores the signature, and reads the text', async ({
    page,
    user,
    jmap
  }) => {
    const accountId = await jmap.accountId()
    await jmap.request([
      [
        'Identity/set',
        {
          accountId,
          create: {
            first: {
              name: 'Identity with attachment keyword',
              email: user.email,
              textSignature: 'Signature file',
              sortOrder: 0
            },
            second: {
              name: 'Identity without attachment keyword',
              email: user.email,
              textSignature: 'Signature',
              sortOrder: 1
            }
          }
        },
        's'
      ]
    ])
    const mailbox = await new LoginPage(page).loginAs(user)

    let composer = await mailbox.compose()
    await expect(composer.identitySelect).toContainText(
      'Identity with attachment keyword'
    )
    await composer.fill({
      to: [user.email],
      subject: 'Test Reminder',
      body: 'Test Reminder'
    })
    await composer.send()
    await expect(mailbox.toast).toContainText(
      'Message has been sent successfully'
    )

    composer = await mailbox.compose()
    await composer.fill({
      to: [user.email],
      subject: 'Test Reminder',
      body: 'file in content'
    })
    await composer.chooseIdentity('Identity without attachment keyword')
    await composer.sendButton.click()

    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toContainText('Forgot to attach a file?')
    await expect(dialog).toContainText(
      'You wrote "file" in your message but did not add any attachments. Do you still want to send?'
    )
    await expectNoA11yViolations(page)
    await dialog.getByRole('button', { name: 'Send message' }).click()
    await expect(composer.root).toBeHidden()
  })

  test('CMP-48 a message is received with the Reply-To and the Bcc of its identity', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const archive = await users.create({ prefix: 'archive' })
    const accountId = await jmap.accountId()
    await jmap.request([
      [
        'Identity/set',
        {
          accountId,
          create: {
            main: {
              name: 'Support',
              email: user.email,
              replyTo: [{ name: null, email: 'replies@example.com' }],
              bcc: [{ name: null, email: archive.email }],
              sortOrder: 0
            }
          }
        },
        's'
      ]
    ])
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await expect(composer.recipients('bcc')).toHaveText([archive.email])
    await composer.fill({ to: [user.email], subject: 'From support' })
    await composer.send()

    const email = await received(jmap, 'From support')
    expect(email.replyTo).toEqual([
      { name: 'Support', email: 'replies@example.com' }
    ])
    await jmapFor(archive).waitForEmail({ subject: 'From support' })
  })

  test('KBD-05 "?" lists the keys of a message being written', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.expectLoaded()
    await page.keyboard.press('?')

    const dialog = page.getByTestId('shortcuts-dialog')
    const table = dialog.getByRole('table', {
      name: 'In a message being written'
    })
    await expect(table).toContainText('Ctrl + Enter')
    await expect(table).toContainText('Send the message')
    await expect(table).toContainText('Ctrl + K')
    await expectNoA11yViolations(page)
  })
})
