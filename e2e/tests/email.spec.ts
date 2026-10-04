import { LoginPage } from '../pages'
import { expect, test } from '../support/fixtures'

const SENTENCE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'

test.describe('EML reading an email', () => {
  test('EML-01 an email with a short body shows its whole content', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'short content', text: SENTENCE })
    await jmap.waitForEmail({ subject: 'short content' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('short content')

    await expect(email.body()).toContainText(SENTENCE)
    await expect(email.from).toContainText(user.email)
    await expect(email.to).toContainText(user.email)
  })

  test('EML-03 a script in an email body never runs', async ({
    page,
    user,
    jmap
  }) => {
    const dialogs: string[] = []
    page.on('dialog', dialog => {
      dialogs.push(dialog.message())
      void dialog.dismiss()
    })
    await jmap.sendEmail({
      to: user.email,
      subject: 'xss content',
      html: '<p>Harmless text</p><script>alert("XSSRobot")</script><img src="x" onerror="alert(\'XSSRobot\')">'
    })
    await jmap.waitForEmail({ subject: 'xss content' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('xss content')

    await expect(email.body()).toContainText('Harmless text')
    expect(await email.body().innerHTML()).not.toMatch(/XSSRobot|<script|onerror/)
    expect(dialogs).toEqual([])
  })

  test('EML-28 opening an unread email marks it read', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'to be read', text: 'hi' })
    const sent = await jmap.waitForEmail({ subject: 'to be read' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('to be read')).toHaveAttribute('data-unread', 'true')
    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toHaveText('1')

    const email = await mailbox.openEmail('to be read')
    await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toBeHidden()
    await email.back()

    await expect(mailbox.emailRow('to be read')).not.toHaveAttribute('data-unread')
    await expect
      .poll(async () => (await jmap.getEmail(sent.id)).keywords)
      .toEqual(expect.objectContaining({ $seen: true }))
  })
})
