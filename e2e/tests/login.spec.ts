import type { Page } from '@playwright/test'

import { LoginPage, MailboxPage } from '../pages'
import { openAccountMenuIfAny } from '../support/accountMenu'
import { expectNoA11yViolations } from '../support/a11y'
import { type E2EUser, expect, test } from '../support/fixtures'

/**
 * A tab opened next to a signed-in one gets its session over the
 * `twake-mail-basic-session` BroadcastChannel: the mailbox shows, and the
 * login form never does (`LoginPage.loginAs` would fill it)
 */
async function expectSessionHandedOver(page: Page): Promise<MailboxPage> {
  const mailbox = new MailboxPage(page)
  const login = new LoginPage(page)
  await expect(mailbox.folderTree.or(login.usernameInput)).toBeVisible()
  await expect(login.usernameInput).toHaveCount(0)
  return mailbox.expectLoaded()
}

/** Everything the tab keeps in web storage, keys and values */
async function webStorage(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify([
      Object.entries(window.localStorage),
      Object.entries(window.sessionStorage)
    ])
  )
}

/** What the password of `user` looks like in a Basic authorization header */
function basicCredentials(user: E2EUser): string {
  return Buffer.from(`${user.email}:${user.password}`).toString('base64')
}

test.describe('LOGIN login', () => {
  test('LOGIN-01 logging in with basic auth lands on the inbox email list', async ({
    page,
    user
  }) => {
    const login = await new LoginPage(page).goto()
    await expectNoA11yViolations(page)

    const mailbox = await login.loginAs(user)

    await mailbox.expectFolderSelected({ role: 'inbox' })
    // A brand new account: the thread view of its empty inbox
    await expect(mailbox.emptyListView).toBeVisible()
    await expectNoA11yViolations(page)

    // No Workplace in the stack, as tmail-flutter: on a desktop its bar, the
    // log out behind the initial of the user; below, the log out in the
    // folder drawer
    if (mailbox.hasFolderDrawer()) {
      await expect(page.getByTestId('twake-bar')).toHaveCount(0)
      await mailbox.showFolders()
      await expect(
        page.getByTestId('drawer-header').getByTestId('logout-button')
      ).toBeVisible()
    } else {
      await expect(page.getByTestId('twake-bar')).toBeVisible()
      await page.getByTestId('account-menu-button').click()
      await expect(page.getByTestId('logout-button')).toBeVisible()
    }
  })

  test('LOGIN-02 a wrong password is refused with an alert, and no mail shows', async ({
    page,
    user
  }) => {
    const login = await new LoginPage(page).goto()
    await login.usernameInput.fill(user.email)
    await login.passwordInput.fill(`${user.password}-wrong`)
    await login.submitButton.click()

    await expect(login.errorMessage).toHaveRole('alert')
    await expect(login.errorMessage).toContainText('Bad credentials')
    await expect(page).toHaveURL(/\/login/)
    await expect(new MailboxPage(page).folderTree).toHaveCount(0)
    await expectNoA11yViolations(page)

    await login.passwordInput.fill(user.password)
    await login.submitButton.click()
    await new MailboxPage(page).expectLoaded()
  })

  test('LOGIN-03 a new tab gets the session of a signed-in tab, a lone reload asks again', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'sent' })
    const sentUrl = page.url()

    const second = await page.context().newPage()
    await second.goto(sentUrl)
    const secondMailbox = await expectSessionHandedOver(second)
    await secondMailbox.expectFolderSelected({ role: 'sent' })

    // The second tab hands the session back to the reloaded first one
    await page.reload()
    await expectSessionHandedOver(page)
    await mailbox.expectFolderSelected({ role: 'sent' })

    // Kept in tab memory only
    for (const tab of [page, second]) {
      const stored = await webStorage(tab)
      expect(stored).not.toContain(user.password)
      expect(stored).not.toContain(basicCredentials(user))
    }

    // No other tab to ask: the form, then back where the user was
    await second.close()
    await page.reload()
    await new LoginPage(page).loginAfterReload(user)
    await expect(page).toHaveURL(sentUrl)
    await mailbox.expectFolderSelected({ role: 'sent' })
  })

  test('LOGIN-04 signing out ends every tab of the account, not the tabs of another account', async ({
    page,
    user,
    users,
    browser
  }) => {
    const other = await users.create({ prefix: 'other' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const inboxUrl = page.url()
    const second = await page.context().newPage()
    await second.goto('/')
    await expectSessionHandedOver(second)

    const otherContext = await browser.newContext()
    try {
      const otherPage = await otherContext.newPage()
      const otherMailbox = await new LoginPage(otherPage).loginAs(other)

      await mailbox.expectFolderSelected({ role: 'inbox' })
      await openAccountMenuIfAny(page)
      await page.getByTestId('logout-button').click()

      for (const tab of [page, second]) {
        const login = new LoginPage(tab)
        await expect(login.usernameInput).toBeVisible()
        await expect(tab).toHaveURL(/\/login/)
        await expect(new MailboxPage(tab).folderTree).toHaveCount(0)
      }

      // A deep link shows the form, not the mail
      await page.goto(inboxUrl)
      await expect(new LoginPage(page).usernameInput).toBeVisible()
      await expect(page).toHaveURL(/\/login/)
      await expect(mailbox.folderTree).toHaveCount(0)

      // The other account, in its own browser, is still signed in
      await expect(otherMailbox.folderTree).toBeVisible()
      await expect(new LoginPage(otherPage).usernameInput).toHaveCount(0)
      await expect(otherPage).not.toHaveURL(/\/login/)
    } finally {
      await otherContext.close()
    }
  })
})
