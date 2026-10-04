import { LoginPage } from '../pages'
import { expect, test } from '../support/fixtures'

test.describe('PUSH real-time updates', () => {
  test('PUSH-01 a new email appears live, then follows its read and star changes', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emptyListView).toBeVisible()

    await jmap.sendEmail({ to: user.email, subject: 'pushed email', text: 'hi' })

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
  })
})
