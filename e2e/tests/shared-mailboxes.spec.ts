import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('SHM folders shared by other users', () => {
  test('SHM-01 a folder another user shares shows under "Other users", without the actions it does not support', async ({
    page,
    user,
    users,
    jmapFor
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const bobJmap = jmapFor(bob)
    const shared = await bobJmap.createMailbox({ name: 'abc' })
    await bobJmap.createEmailIn(shared.id, { subject: 'Shared news' })
    // Every right but administering the folder: lookup, read, seen, write,
    // insert, create, delete folder, delete messages, expunge
    await bobJmap.shareMailbox(shared.id, user.email, [
      'l',
      'r',
      's',
      'w',
      'i',
      'k',
      'x',
      't',
      'e'
    ])

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.showFolders()

    // Below the team mailboxes, with the address of its owner, not hidden
    // although the user is not subscribed to it
    const section = mailbox.otherUsersSection
    await expect(section).toBeVisible()
    await expect(section.getByTestId('mailbox-item-name')).toHaveText(['abc'])
    await expect(section.getByTestId('mailbox-item-address')).toHaveText(
      bob.email
    )
    await expect(section.getByTestId('mailbox-item-hidden')).toHaveCount(0)
    await expect(
      mailbox.teamMailboxesSection.getByText('abc', { exact: true })
    ).toHaveCount(0)
    await expectNoA11yViolations(page)

    // A folder holding emails, not a container
    await mailbox.openFolder({ id: shared.id })
    await expect(mailbox.emailRow('Shared news')).toBeVisible()

    // Neither Archive nor Spam for its emails
    const emailMenu = await mailbox.openEmailMenu('Shared news')
    await expect(emailMenu.getByTestId('email-action-move-to-trash')).toBeVisible()
    await expect(emailMenu.getByTestId('email-action-archive')).toBeHidden()
    await expect(emailMenu.getByTestId('email-action-mark-as-spam')).toBeHidden()
    await page.keyboard.press('Escape')

    // The folder of another user is neither moved, renamed, hidden nor
    // deleted from here
    const folderMenu = await mailbox.openFolderMenu({ id: shared.id })
    await expect(
      folderMenu.getByTestId('mailbox-action-new-subfolder')
    ).toBeVisible()
    for (const action of ['move', 'rename', 'hide', 'delete', 'create-filter']) {
      await expect(
        folderMenu.getByTestId(`mailbox-action-${action}`)
      ).toBeHidden()
    }
  })
})
