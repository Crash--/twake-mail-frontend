import { type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

import { ComposerPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

const UNSUBSCRIBE_HOST = 'https://unsubscribe.example.test'

/** Records the HTML of the frames the app prints through (`print-frame`) */
async function recordPrintedDocuments(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const printed: string[] = []
    Object.assign(window, { printedDocuments: printed })
    new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (
            node instanceof HTMLIFrameElement &&
            node.dataset.testid === 'print-frame'
          ) {
            printed.push(node.srcdoc)
          }
        })
      }
    }).observe(document, { childList: true, subtree: true })
  })
}

async function printedDocuments(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.hasOwn(window, 'printedDocuments')
      ? (window as unknown as { printedDocuments: string[] }).printedDocuments
      : []
  )
}

test.describe('EACT email actions of the reading view', () => {
  test.use({ emailsOneByOne: true })

  test('EACT-01 Print all prints the headers, the whole body with its quote and the attachments', async ({
    page,
    user,
    jmap
  }) => {
    await recordPrintedDocuments(page)
    await jmap.sendEmail({
      to: user.email,
      cc: ['carol@example.com'],
      subject: 'Quarterly report',
      html: '<p>See the figures</p><blockquote>An older line</blockquote>',
      attachments: [
        { name: 'figures.csv', type: 'text/csv', content: 'a,b\n1,2\n' }
      ]
    })
    await jmap.waitForEmail({ subject: 'Quarterly report' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('Quarterly report')
    await email.print()

    await expect.poll(async () => (await printedDocuments(page)).length).toBe(1)
    const [document = ''] = await printedDocuments(page)
    expect(document).toContain('<title>Twake Mail - Quarterly report</title>')
    expect(document).toContain(user.email)
    expect(document).toContain('Cc: carol@example.com')
    expect(document).toContain('See the figures')
    expect(document).toContain('An older line')
    expect(document).toContain('<b>figures.csv</b>')
    await expect(mailbox.toast).toContainText('Printing in progress')
    await expectNoA11yViolations(page)
  })

  test('EACT-02 Download message as EML saves the message under the name of its subject', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Archive me: now / later',
      text: 'The body of the message'
    })
    await jmap.waitForEmail({
      subject: 'Archive me: now / later',
      withoutSearch: true
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('Archive me: now / later')
    const downloading = page.waitForEvent('download')
    await email.runAction('download-eml')
    const download = await downloading

    expect(download.suggestedFilename()).toBe('Archive me_ now _ later.eml')
    const path = await download.path()
    const eml = await readFile(path, 'utf8')
    expect(eml).toContain('Subject: Archive me: now / later')
    expect(eml).toContain('The body of the message')
  })

  test('EACT-03 Edit as new email opens a composer with the recipients, subject, body and attachments', async ({
    page,
    user,
    jmap,
    users
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    await jmap.sendEmail({
      to: bob.email,
      cc: [user.email],
      subject: 'Draft this again',
      text: 'Original words',
      attachments: [
        { name: 'notes.txt', type: 'text/plain', content: 'notes' }
      ],
      saveTo: 'sent'
    })
    await jmap.waitForEmail({
      subject: 'Draft this again',
      mailboxRole: 'sent'
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'sent' })
    const email = await mailbox.openEmail('Draft this again')
    await email.runAction('edit-as-new')

    const composer = new ComposerPage(page)
    await expect(composer.root).toBeVisible()
    await expect(composer.subjectInput).toHaveValue('Draft this again')
    await expect(composer.recipients('to')).toContainText(bob.email)
    await expect(composer.recipients('cc')).toContainText(user.email)
    await expect(composer.editor).toContainText('Original words')
    await expect(composer.attachments).toContainText('notes.txt')

    // A new message: the original stays, the copy is sent as another email
    await composer.subjectInput.fill('Draft this again, edited')
    await composer.send()
    const sent = await jmap.waitForEmail({
      subject: 'Draft this again, edited',
      mailboxRole: 'sent'
    })
    expect(sent.id).not.toBe(
      (
        await jmap.waitForEmail({
          subject: 'Draft this again',
          mailboxRole: 'sent'
        })
      ).id
    )
    const { list } = (await jmap.call('Email/get', {
      ids: [sent.id],
      properties: ['inReplyTo', 'references']
    })) as {
      list: { inReplyTo: string[] | null; references: string[] | null }[]
    }
    expect(list[0]).toEqual({ id: sent.id, inReplyTo: null, references: null })
  })

  test.describe('unsubscribe', () => {
    async function seedNewsletter(
      jmap: Parameters<Parameters<typeof test>[2]>[0]['jmap'],
      to: string,
      listUnsubscribe: string
    ): Promise<void> {
      await jmap.sendEmail({
        to,
        subject: 'Weekly digest',
        html: '<p>Our news</p>',
        headers: {
          'List-Unsubscribe': listUnsubscribe,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      })
      await jmap.waitForEmail({ subject: 'Weekly digest' })
    }

    test('EACT-04 Unsubscribe asks first, then opens the link of the sender in a new tab and shows the unsubscribed note', async ({
      page,
      context,
      user,
      jmap
    }) => {
      const reached: string[] = []
      await context.route(`${UNSUBSCRIBE_HOST}/**`, async route => {
        reached.push(`${route.request().method()} ${route.request().url()}`)
        await route.fulfill({
          contentType: 'text/html',
          body: '<p>You are out</p>'
        })
      })
      await seedNewsletter(
        jmap,
        user.email,
        `<${UNSUBSCRIBE_HOST}/u?id=42>, <mailto:leave@example.com>`
      )

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Weekly digest')
      await expect(email.unsubscribeLink).toBeVisible()
      await expect(email.unsubscribedBanner).toBeHidden()

      await email.unsubscribeLink.click()
      const dialog = page.getByTestId('confirm-dialog')
      await expect(dialog).toContainText('Unsubscribe mail')
      await expect(dialog).toContainText('stop receiving similar messages from')
      await expectNoA11yViolations(page)
      // Declined: nothing is fetched, nothing is set
      await dialog.getByTestId('confirm-dialog-cancel-button').click()
      await expect(dialog).toBeHidden()
      await expect(email.unsubscribeLink).toBeFocused()
      expect(reached).toEqual([])
      expect(
        (await jmap.waitForEmail({ subject: 'Weekly digest' })).keywords
      ).not.toHaveProperty('$unsubscribe')

      // Confirmed with the keyboard: the link opens in its own tab, as a GET
      const opening = page.waitForEvent('popup')
      await email.unsubscribeLink.press('Enter')
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Tab')
      await dialog.getByTestId('confirm-dialog-confirm-button').press('Enter')
      const popup = await opening
      await expect(popup.getByText('You are out')).toBeVisible()
      expect(reached).toEqual([`GET ${UNSUBSCRIBE_HOST}/u?id=42`])

      await expect(mailbox.toast).toContainText(
        'Unsubscribed from this mailing list'
      )
      await expect(email.unsubscribedBanner).toContainText(
        'You unsubscribe from'
      )
      await expect(email.unsubscribeLink).toBeHidden()
      await expect
        .poll(
          async () =>
            (await jmap.waitForEmail({ subject: 'Weekly digest' })).keywords
        )
        .toHaveProperty('$unsubscribe', true)
      await expectNoA11yViolations(page)
    })

    test('EACT-05 Unsubscribe by mailto writes to the address in the composer and marks the email once sent', async ({
      page,
      user,
      jmap,
      users
    }) => {
      const list = await users.create({ prefix: 'list' })
      await seedNewsletter(
        jmap,
        user.email,
        `<mailto:${list.email}?subject=unsubscribe%20me>`
      )

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Weekly digest')
      await email.runAction('unsubscribe')
      await page
        .getByTestId('confirm-dialog')
        .getByTestId('confirm-dialog-confirm-button')
        .click()

      const composer = new ComposerPage(page)
      await expect(composer.subjectInput).toHaveValue('unsubscribe me')
      await expect(composer.recipients('to')).toContainText(list.email)
      // Not unsubscribed until the message goes
      expect(
        (await jmap.waitForEmail({ subject: 'Weekly digest' })).keywords
      ).not.toHaveProperty('$unsubscribe')
      await composer.send()

      await expect
        .poll(
          async () =>
            (await jmap.waitForEmail({ subject: 'Weekly digest' })).keywords
        )
        .toHaveProperty('$unsubscribe', true)
      await expect(email.unsubscribedBanner).toBeVisible()
    })

    test('EACT-06 an email without a usable List-Unsubscribe link offers no Unsubscribe', async ({
      page,
      user,
      jmap
    }) => {
      await seedNewsletter(jmap, user.email, '<javascript:alert(1)>')

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Weekly digest')
      await expect(email.unsubscribeLink).toBeHidden()
      const menu = await email.openMoreMenu()
      await expect(menu.getByTestId('email-action-unsubscribe')).toBeHidden()
      await expect(menu.getByTestId('email-action-print')).toBeVisible()
    })

    test(
      'EACT-07 on a phone, Unsubscribe, Print all, Download as EML and Edit as new email are in the More menu',
      { tag: '@mobile' },
      async ({ page, user, jmap }) => {
        await seedNewsletter(jmap, user.email, `<${UNSUBSCRIBE_HOST}/u?id=42>`)

        const mailbox = await new LoginPage(page).loginAs(user)
        const email = await mailbox.openEmail('Weekly digest')
        // Beside the sender on a desktop only
        const isPhone = (page.viewportSize()?.width ?? 0) < 600
        if (isPhone) await expect(email.unsubscribeLink).toBeHidden()
        else await expect(email.unsubscribeLink).toBeVisible()
        const menu = await email.openMoreMenu()
        for (const action of [
          'unsubscribe',
          'print',
          'download-eml',
          'edit-as-new'
        ]) {
          await expect(menu.getByTestId(`email-action-${action}`)).toBeVisible()
        }
        await expectNoA11yViolations(page)
      }
    )
  })
})
