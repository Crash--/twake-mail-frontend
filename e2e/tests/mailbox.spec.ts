import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('MBX mailbox and folders', () => {
  test('MBX-05 switching folder shows the emails of that folder', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'sent subject',
      text: 'hello'
    })
    await jmap.sendEmail({
      to: user.email,
      subject: 'trash subject',
      text: 'hello',
      saveTo: 'trash'
    })
    await jmap.waitForEmail({ subject: 'sent subject', mailboxRole: 'sent' })
    await jmap.waitForEmail({ subject: 'trash subject', mailboxRole: 'trash' })

    const mailbox = await new LoginPage(page).loginAs(user)

    await mailbox.openFolder({ role: 'sent' })
    await expect(mailbox.emailRow('sent subject')).toHaveCount(1)
    await expect(mailbox.emailRow('trash subject')).toHaveCount(0)
    await expectNoA11yViolations(page)

    await mailbox.openFolder({ role: 'trash' })
    await expect(mailbox.emailRow('trash subject')).toHaveCount(1)
    await expect(mailbox.emailRow('sent subject')).toHaveCount(0)
  })

  test('MBX-17 the inbox unread counter follows new and read emails in real time', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emptyListView).toBeVisible()
    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toBeHidden()

    await jmap.sendEmail({ to: user.email, subject: 'real time', text: 'hi' })

    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toHaveText('1')

    const email = await jmap.waitForEmail({ subject: 'real time' })
    await jmap.setKeywords(email.id, { $seen: true })

    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toBeHidden()
  })
})
