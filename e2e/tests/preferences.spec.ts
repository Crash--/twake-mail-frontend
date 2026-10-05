import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

const SETTINGS = 'com:linagora:params:jmap:settings'

test.describe('SET preferences', () => {
  test('SET-01 toggling "Thread" and "Sender-set important flag" in Preferences', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()
    await settings.open('preferences')

    const thread = page.getByRole('switch', { name: 'Enable thread' })
    const senderPriority = page.getByRole('switch', {
      name: 'Display sender-set important flag'
    })
    await expect(thread).toBeChecked()
    await thread.click()
    await expect(thread).not.toBeChecked()
    await thread.click()
    await expect(thread).toBeChecked()

    // On by default (tmail-flutter), kept on the server
    await expect(senderPriority).toBeChecked()
    await senderPriority.click()
    await expect(senderPriority).not.toBeChecked()
    await expect
      .poll(async () => {
        const result = await jmap.call('Settings/get', { ids: null }, [
          SETTINGS
        ])
        return (result.list as { settings: Record<string, string> }[])[0]
          ?.settings
      })
      .toMatchObject({ 'display.sender.priority': 'false' })
    await expectNoA11yViolations(page)
    await senderPriority.click()
    await expect(senderPriority).toBeChecked()
  })

  test('SET-03 changing the language re-localises the app at once and for good', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()
    await settings.open('language-region')
    const select = page.getByTestId('language-select')

    await select.selectOption({ label: 'English - English' })
    await expect(settings.heading).toHaveText('Language')
    await select.selectOption({ label: 'Vietnamese - Tiếng Việt' })
    await expect(settings.heading).toHaveText('Ngôn ngữ')
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
    await expectNoA11yViolations(page)
    await expect
      .poll(async () => {
        const result = await jmap.call('Settings/get', { ids: null }, [
          SETTINGS
        ])
        return (result.list as { settings: Record<string, string> }[])[0]
          ?.settings
      })
      .toMatchObject({ language: 'vi' })

    // Another browser of the user follows the account
    await page.context().clearCookies()
    await page.evaluate(() => {
      window.localStorage.clear()
    })
    await new LoginPage(page).loginAs(user)
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  })

  test(
    'SET-08 a vacation response shows its banner until ended from it',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const settings = await mailbox.openSettings()
      await settings.open('vacation')
      await expect(page.getByTestId('vacation-banner')).toHaveCount(0)

      // Off: the message is greyed out like the other fields, not editable
      const message = page.getByTestId('vacation-message-editor')
      await expect(message).toHaveAttribute('aria-disabled', 'true')
      await expect(message).toHaveAttribute('contenteditable', 'false')
      await expect(page.getByTestId('vacation-subject-input')).toBeDisabled()
      await expectNoA11yViolations(page)

      await page
        .getByRole('switch', {
          name: 'Automatically reply to messages when they are received.'
        })
        .click()
      await expect(message).toHaveAttribute('contenteditable', 'true')
      await expect(message).not.toHaveAttribute('aria-disabled')
      await page.getByTestId('vacation-start-date-input').fill('2020-01-01')
      await page.getByTestId('vacation-save-button').click()
      await expect(page.getByTestId('vacation-error')).toHaveText(
        'Message body cannot be blank'
      )
      await page.getByTestId('vacation-subject-input').fill('Away')
      await page.getByTestId('vacation-message-editor').click()
      await page.keyboard.type('I am away.')
      await page.getByTestId('vacation-save-button').click()
      await expect(settings.toast).toContainText('Vacation settings saved')
      await expect(page.getByTestId('vacation-banner')).toContainText(
        'Your vacation responder is enabled.'
      )
      await expectNoA11yViolations(page)
      await expect
        .poll(async () => {
          const result = await jmap.call(
            'VacationResponse/get',
            { ids: ['singleton'] },
            ['urn:ietf:params:jmap:vacationresponse']
          )
          return (result.list as unknown[])[0]
        })
        .toMatchObject({
          isEnabled: true,
          subject: 'Away',
          htmlBody: '<p>I am away.</p>'
        })

      await settings.backToMail()
      await expect(mailbox.root).toBeVisible()
      const banner = page.getByTestId('vacation-banner')
      await expect(banner).toBeVisible()
      await banner.getByRole('button', { name: 'End now' }).click()
      await expect(mailbox.toast).toContainText(
        'Your vacation responder is disabled successfully'
      )
      await expect(banner).toHaveCount(0)
    }
  )

  test('SET-09 a folder hidden in "Folder visibility" leaves the tree until shown again', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.createMailbox({ name: 'Projects' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(
      mailbox.folderTree.getByText('Projects', { exact: true })
    ).toBeVisible()
    const settings = await mailbox.openSettings()
    await settings.open('folder-visibility')
    await expect(
      page
        .getByTestId('folder-visibility-item')
        .filter({ hasText: 'Inbox' })
        .first()
        .getByTestId('folder-visibility-toggle')
    ).toHaveCount(0)
    await expectNoA11yViolations(page)

    await page.getByRole('button', { name: 'Hide Projects' }).click()
    await expect(
      page.getByRole('button', { name: 'Show Projects' })
    ).toBeVisible()
    await settings.backToMail()
    await expect(
      mailbox.folderTree.getByText('Projects', { exact: true })
    ).toHaveCount(0)

    await mailbox.openSettings()
    await settings.open('folder-visibility')
    await page.getByRole('button', { name: 'Show Projects' }).click()
    await expect(
      page.getByRole('button', { name: 'Hide Projects' })
    ).toBeVisible()
    await settings.backToMail()
    await expect(
      mailbox.folderTree.getByText('Projects', { exact: true })
    ).toBeVisible()
  })

  test('SET-10 unread spam shows a banner in the other folders, opened or dismissed from it, and turned off in Preferences', async ({
    page,
    user,
    jmap
  }) => {
    const spam = await jmap.findMailboxByRole('junk')
    await jmap.createEmailIn(spam.id, { subject: 'Cheap pills', keywords: {} })

    const mailbox = await new LoginPage(page).loginAs(user)
    const banner = page.getByTestId('spam-report-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toHaveRole('status')
    await expect(banner).toContainText('1 message in spam')
    await expectNoA11yViolations(page)

    // Dismissed: gone for 24 hours, kept in this browser
    await banner.getByRole('button', { name: 'Dismiss' }).click()
    await expect(banner).toHaveCount(0)
    const away = await mailbox.openSettings()
    await away.backToMail()
    await expect(mailbox.root).toBeVisible()
    await expect(banner).toHaveCount(0)

    // Back after the delay, with the preference turned off it stays away
    await page.evaluate(() => {
      window.localStorage.removeItem('twake-mail.preferences.spamReport')
    })
    const elsewhere = await mailbox.openSettings()
    await elsewhere.backToMail()
    await expect(banner).toBeVisible()
    await banner.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(new RegExp(`/mailbox/${spam.id}`))
    await expect(banner).toHaveCount(0)

    await page.evaluate(() => {
      window.localStorage.removeItem('twake-mail.preferences.spamReport')
    })
    const settings = await mailbox.openSettings()
    await settings.open('preferences')
    const toggle = page.getByRole('switch', { name: 'Enable spam report' })
    await expect(toggle).toBeChecked()
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await settings.backToMail()
    await expect(mailbox.root).toBeVisible()
    await expect(banner).toHaveCount(0)
  })
})
