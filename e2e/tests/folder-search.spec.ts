import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('MBX folder search of the sidebar', () => {
  test('MBX-04 the magnifier of the "Folders" header finds a folder by its name, and opens it', { tag: '@mobile' }, async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)

    await mailbox.searchFolders('Inbox')
    await expect(mailbox.folderSearchButton).toHaveAttribute('aria-expanded', 'true')
    await expect(mailbox.folderSearchResults.getByTestId('mailbox-item')).toHaveCount(1)
    await expect(mailbox.folder({ role: 'inbox' })).toBeVisible()
    await expect(mailbox.folderSearchStatus).toHaveText('1 folder found')
    await expect(mailbox.folderTree).toBeHidden()
    await expectNoA11yViolations(page)

    await mailbox.searchFolders('sent')
    await expect(mailbox.folderSearchResults.getByTestId('mailbox-item')).toHaveCount(1)
    await mailbox.openFolder({ role: 'sent' })
    await mailbox.expectFolderSelected({ role: 'sent' })
  })

  test('MBX-31 a subfolder shows its path, a team mailbox its address, whatever the case or the accents', { tag: '@mobile' }, async ({
    page,
    user,
    users,
    jmap
  }) => {
    const inbox = await jmap.findMailboxByRole('inbox')
    const clients = await jmap.createMailbox({ name: 'Clients', parentId: inbox.id })
    await jmap.createMailbox({ name: 'Éléphants', parentId: clients.id })
    const team = await users.createTeamMailbox({ members: [user] })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.searchFolders('elephants')
    const subfolder = mailbox.folder({ name: 'Éléphants' })
    await expect(subfolder).toBeVisible()
    await expect(subfolder).toContainText('Inbox/Clients/Éléphants')
    await expectNoA11yViolations(page)

    await mailbox.searchFolders(team.name.toUpperCase())
    const root = mailbox.folder({ name: team.name })
    await expect(root).toBeVisible()
    await expect(root).toContainText(team.email)
    await expect(mailbox.folderSearchStatus).toContainText('found')

    await mailbox.searchFolders('no such folder')
    await expect(mailbox.folderSearchResults).toBeHidden()
    await expect(mailbox.folderSearchStatus).toHaveText('No folder matches your search')
  })

  test('MBX-32 a hidden folder is found, shown again from its menu with the keyboard, and Escape closes the search', { tag: '@mobile' }, async ({
    page,
    user,
    jmap
  }) => {
    await jmap.createMailbox({ name: 'Rarely used' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.runFolderAction({ name: 'Rarely used' }, 'hide')
    await expect(mailbox.toast).toContainText('This folder has been hidden from your primary folder')
    await expect(mailbox.folder({ name: 'Rarely used' })).toBeHidden()

    await mailbox.searchFolders('rarely')
    const hidden = mailbox.folder({ name: 'Rarely used' })
    await expect(hidden).toHaveAttribute('data-hidden', 'true')
    await expect(hidden.getByTestId('mailbox-item-hidden')).toBeVisible()

    // Down from the field to the result, then its menu with the menu key
    await page.keyboard.press('ArrowDown')
    await expect(hidden).toBeFocused()
    await page.keyboard.press('Shift+F10')
    const menu = page.getByTestId('mailbox-context-menu').getByRole('menu')
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await menu.getByTestId('mailbox-action-show').press('Enter')

    await expect(hidden).not.toHaveAttribute('data-hidden')
    await expect(mailbox.toast).toContainText('This folder is shown again')
    await expect(mailbox.folderSearchInput).toBeVisible()

    // Escape folds the search only, the focus goes back to the magnifier
    await mailbox.folderSearchInput.press('Escape')
    await expect(mailbox.folderSearch).toBeHidden()
    await expect(mailbox.folderSearchButton).toBeFocused()
    await expect(mailbox.folderSearchButton).toHaveAttribute('aria-expanded', 'false')
    if (mailbox.hasFolderDrawer()) await expect(mailbox.folderDrawer).toBeVisible()
    await expect(mailbox.folder({ name: 'Rarely used' })).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('MBX-33 the search leads to Settings > Folder visibility', { tag: '@mobile' }, async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)

    await mailbox.searchFolders('')
    await mailbox.page.getByTestId('mailbox-search-visibility-link').click()

    await expect(page).toHaveURL(/\/settings\/folder-visibility$/)
    await expect(page.getByTestId('folder-visibility-personal')).toBeVisible()
  })
})
