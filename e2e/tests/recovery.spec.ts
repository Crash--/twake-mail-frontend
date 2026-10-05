import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('MBX recovery and quota', () => {
  test('MBX-11 emails emptied from the Trash come back in "Recovered"', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Recover me',
      text: 'x',
      saveTo: 'trash'
    })
    await jmap.waitForEmail({ subject: 'Recover me', mailboxRole: 'trash' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'trash' })
    await mailbox.emptyTrashBanner
      .getByRole('button', { name: 'Empty Trash now' })
      .click()
    await mailbox.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()
    await expect(mailbox.emptyTrashBanner).toBeHidden()

    await mailbox.runFolderAction({ role: 'trash' }, 'recover-deleted-messages')
    const dialog = page.getByTestId('recovery-dialog')
    await expect(dialog).toContainText(
      'You can recover messages deleted during the past 15 days'
    )
    await expectNoA11yViolations(page)
    await dialog.getByTestId('recovery-restore-button').click()

    await expect(mailbox.toast).toContainText(/messages? recovered/)
    await page.getByTestId('recovery-open-button').click()
    await expect(mailbox.emailRow('Recover me')).toBeVisible()
    await mailbox.expectFolderSelected({ name: 'Recovered' })
  })

  test('MBX-13 emails emptied from Spam are recovered from the Trash', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'junk mail',
      text: 'x',
      saveTo: 'junk'
    })
    await jmap.waitForEmail({ subject: 'junk mail', mailboxRole: 'junk' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'junk' })
    await mailbox.emptyTrashBanner
      .getByRole('button', { name: 'Delete all spam emails now' })
      .click()
    await mailbox.confirmDialog
      .getByRole('button', { name: 'Delete all' })
      .click()
    await expect(mailbox.emptyTrashBanner).toBeHidden()

    await mailbox.runFolderAction({ role: 'trash' }, 'recover-deleted-messages')
    await page
      .getByTestId('recovery-dialog')
      .getByTestId('recovery-restore-button')
      .click()
    await page.getByTestId('recovery-open-button').click()
    await expect(mailbox.emailRow('junk mail')).toBeVisible()
  })

  test('MBX-14 emails emptied from the Spam menu are recovered from the Trash', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'more junk',
      text: 'x',
      saveTo: 'junk'
    })
    await jmap.waitForEmail({ subject: 'more junk', mailboxRole: 'junk' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.runFolderAction({ role: 'junk' }, 'empty-spam')
    await mailbox.confirmDialog
      .getByRole('button', { name: 'Delete all' })
      .click()
    await expect(mailbox.toast).toContainText(
      'All messages have been deleted forever'
    )

    await mailbox.runFolderAction({ role: 'trash' }, 'recover-deleted-messages')
    await page
      .getByTestId('recovery-dialog')
      .getByTestId('recovery-restore-button')
      .click()
    await page.getByTestId('recovery-open-button').click()
    await expect(mailbox.emailRow('more junk')).toBeVisible()
  })

  test.describe('quota', () => {
    test.use({ userQuota: { count: 200, size: 50_000_000 } })

    test('MBX-18 the storage used grows with an email sent with an attachment', async ({
      page,
      user,
      jmap
    }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const indicator = page.getByTestId('quota-indicator')
      await expect(indicator).toContainText('50 MB available')
      const before = Number(await indicator.getAttribute('data-used'))

      await jmap.sendEmail({
        to: user.email,
        subject: 'With a file',
        text: 'x',
        attachments: [
          { name: 'notes.txt', type: 'text/plain', content: 'x'.repeat(20_000) }
        ]
      })
      await jmap.waitForEmail({ subject: 'With a file' })

      // Push brings the new quota
      await expect
        .poll(async () => Number(await indicator.getAttribute('data-used')))
        .toBeGreaterThan(before)
      await expectNoA11yViolations(page)

      const settings = await mailbox.openSettings()
      await settings.open('storage')
      await expect(page.getByTestId('storage-settings')).toContainText(
        'of 50 MB used'
      )
      await expect(page.getByTestId('storage-settings')).toContainText(
        'Available:'
      )
      await expectNoA11yViolations(page)
    })
  })
})
