import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

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

    // No Workplace in the stack: the platform bar, with a log out button
    await expect(page.getByTestId('twake-bar')).toBeVisible()
    await expect(page.getByTestId('logout-button')).toBeVisible()
  })
})
