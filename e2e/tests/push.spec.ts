import { LoginPage } from '../pages'
import { expect, test } from '../support/fixtures'
import { recordJmapTraffic } from '../support/jmapTraffic'

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

    // Incremental: the changes are fetched, the list is never queried again
    expect(traffic.methods()).toContain('Email/changes')
    expect(traffic.methods()).not.toContain('Email/query')
  })
})
