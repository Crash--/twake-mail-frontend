import { LoginPage } from '../pages'
import { expect, test } from '../support/fixtures'

test.describe('LOGIN login', () => {
  test('LOGIN-01 logging in with basic auth lands on the inbox email list', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)

    await expect(mailbox.folder({ role: 'inbox' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    // A brand new account: the thread view of its empty inbox
    await expect(mailbox.emptyListView).toBeVisible()

    await mailbox.userAvatar.click()
    await expect(page.getByTestId('user-menu-identity')).toContainText(
      user.email
    )
  })
})
