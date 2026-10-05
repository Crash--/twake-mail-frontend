import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('MBX folders', () => {
  test('MBX-01 "New folder" creates a personal folder in the sidebar', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.addFolderButton.click()
    await expect(mailbox.mailboxNameDialog).toBeVisible()
    await expectNoA11yViolations(page)
    await mailbox.submitFolderName('crud personal folder')

    await expect(mailbox.toast).toContainText(
      'You successfully created crud personal folder folder'
    )
    await expect(
      mailbox.folder({ name: 'crud personal folder' })
    ).toHaveAttribute('aria-current', 'page')
    await expect
      .poll(async () =>
        (await jmap.getMailboxes()).some(
          item => item.name === 'crud personal folder'
        )
      )
      .toBe(true)
  })

  test('MBX-02 a subfolder of the Inbox is created, renamed, moved under Archive, then deleted', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.runFolderAction({ role: 'inbox' }, 'new-subfolder')
    await mailbox.submitFolderName('crud sub folder')
    await expect(mailbox.folder({ name: 'crud sub folder' })).toHaveAttribute(
      'aria-current',
      'page'
    )

    await mailbox.runFolderAction({ name: 'crud sub folder' }, 'rename')
    await mailbox.submitFolderName('renamed sub folder')
    await expect(mailbox.folder({ name: 'renamed sub folder' })).toBeVisible()

    await mailbox.runFolderAction({ name: 'renamed sub folder' }, 'move')
    await mailbox.pickFolder('Archive')
    await expect(mailbox.toast).toContainText('Moved to Archive')
    await expect(mailbox.folder({ role: 'archive' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    const archive = await jmap.findMailboxByRole('archive')
    await expect
      .poll(
        async () =>
          (await jmap.findMailboxByName('renamed sub folder')).parentId
      )
      .toBe(archive.id)

    await mailbox.runFolderAction({ name: 'renamed sub folder' }, 'delete')
    await expect(mailbox.confirmDialog).toBeVisible()
    await expectNoA11yViolations(page)
    await mailbox.confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(mailbox.folder({ name: 'renamed sub folder' })).toBeHidden()
    await expect(mailbox.folder({ role: 'archive' })).not.toHaveAttribute(
      'aria-expanded'
    )
    await expect(mailbox.folder({ role: 'inbox' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  test('MBX-03 a hidden subfolder leaves the Inbox without children', async ({
    page,
    user,
    jmap
  }) => {
    const inbox = await jmap.findMailboxByRole('inbox')
    await jmap.createMailbox({ name: 'hidden sub folder', parentId: inbox.id })

    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.folder({ role: 'inbox' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await mailbox.toggleFolder({ role: 'inbox' })
    await mailbox.runFolderAction({ name: 'hidden sub folder' }, 'hide')

    await expect(mailbox.toast).toContainText(
      'This folder has been hidden from your primary folder'
    )
    await expect(mailbox.folder({ name: 'hidden sub folder' })).toBeHidden()
    await expect(mailbox.folder({ role: 'inbox' })).not.toHaveAttribute(
      'aria-expanded'
    )
    await mailbox.openFolder({ role: 'inbox' })
  })

  test(
    'MBX-06 the Starred folder is listed, empty on a new account',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.showFolders()
      await mailbox.folder({ name: 'Starred' }).click()
      await mailbox.hideFolders()

      await expect(mailbox.emptyListView).toBeVisible()
      await mailbox.expectFolderSelected({ name: 'Starred' })
      await expectNoA11yViolations(page)
    }
  )

  test(
    'MBX-06b Starred follows the whole Inbox subtree, in the DOM and with the keyboard',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const inbox = await jmap.findMailboxByRole('inbox')
      await jmap.createMailbox({ name: 'Newsletters', parentId: inbox.id })

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.toggleFolder({ role: 'inbox' })
      await expect(mailbox.folder({ name: 'Newsletters' })).toHaveAttribute(
        'aria-level',
        '2'
      )

      const rows = mailbox.folderTree.getByTestId('mailbox-item')
      const names = rows.getByTestId('mailbox-item-name')
      await expect(names).toHaveText([
        'Inbox',
        'Newsletters',
        'Starred',
        'Drafts',
        'Outbox',
        'Sent',
        'Trash',
        'Spam',
        'Archive'
      ])
      await expect(
        rows.evaluateAll(items =>
          items.map(item => item.getAttribute('aria-level'))
        )
      ).resolves.toEqual(['1', '2', '1', '1', '1', '1', '1', '1', '1'])
      const starred = mailbox.folder({ name: 'Starred' })
      await expect(starred).toHaveAttribute('aria-posinset', '2')
      await expect(starred).toHaveAttribute('aria-setsize', '8')
      await expect(mailbox.folder({ name: 'Drafts' })).toHaveAttribute(
        'aria-posinset',
        '3'
      )

      // Tab goes Inbox, then its subfolder, then Starred, then Drafts
      await mailbox.folder({ role: 'inbox' }).getByRole('link').focus()
      const visited: string[] = []
      for (let step = 0; step < 12 && !visited.includes('Drafts'); step++) {
        await page.keyboard.press('Tab')
        const name = await page.evaluate(
          () =>
            document.activeElement
              ?.closest('[data-testid="mailbox-item"]')
              ?.querySelector('[data-testid="mailbox-item-name"]')
              ?.textContent ?? null
        )
        if (name !== null && visited.at(-1) !== name) visited.push(name)
      }
      expect(visited).toEqual(['Inbox', 'Newsletters', 'Starred', 'Drafts'])
    }
  )

  test('MBX-07 (receiving part) a team mailbox is listed apart, its emails under its INBOX', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    await jmap.sendEmail({
      to: team.email,
      subject: 'for the team',
      text: 'hello team'
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.teamMailboxesSection).toContainText('Team-mailboxes')
    await mailbox.toggleFolder({ name: team.name })
    await mailbox.openFolder({ name: 'INBOX' })

    await expect(mailbox.emailRow('for the team')).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('MBX-10 "Empty Trash" from the folder menu removes the Trash subfolders', async ({
    page,
    user,
    jmap
  }) => {
    const trash = await jmap.findMailboxByRole('trash')
    await jmap.createMailbox({ name: 'Old stuff', parentId: trash.id })
    await jmap.sendEmail({
      to: user.email,
      subject: 'trashed',
      text: 'x',
      saveTo: 'trash'
    })
    await jmap.waitForEmail({ subject: 'trashed', mailboxRole: 'trash' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.runFolderAction({ role: 'trash' }, 'empty-trash')
    await mailbox.confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(mailbox.toast).toContainText('Trash subfolders deleted')
    await expect(mailbox.folder({ name: 'Old stuff' })).toBeHidden()
    await mailbox.openFolder({ role: 'trash' })
    await expect(mailbox.emptyListView).toBeVisible()
    await expect(mailbox.emptyTrashBanner).toBeHidden()
  })

  test(
    'MBX-15 "Mark as read" on the Inbox clears its unread count',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.sendEmail({
        to: user.email,
        subject: 'unread news',
        text: 'x'
      })
      const email = await jmap.waitForEmail({ subject: 'unread news' })

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.showFolders()
      await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toHaveText('1')
      await mailbox.runFolderAction({ role: 'inbox' }, 'mark-as-read')

      await expect(mailbox.folderUnreadCount({ role: 'inbox' })).toBeHidden()
      await expect(mailbox.toast).toContainText(
        'You’ve marked all messages in "Inbox" as read'
      )
      await expect
        .poll(async () => '$seen' in (await jmap.getEmail(email.id)).keywords)
        .toBe(true)
    }
  )

  test('MBX-29 a hidden folder shows again from the hidden folders, with the keyboard', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.createMailbox({ name: 'Rarely used' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.runFolderAction({ name: 'Rarely used' }, 'hide')
    await expect(mailbox.folder({ name: 'Rarely used' })).toBeHidden()

    await mailbox.showHiddenFoldersButton.click()
    await expect(mailbox.showHiddenFoldersButton).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const hidden = mailbox.folder({ name: 'Rarely used' })
    await expect(hidden).toHaveAttribute('data-hidden', 'true')
    await hidden.getByRole('link').focus()
    await page.keyboard.press('Shift+F10')
    const menu = page.getByTestId('mailbox-context-menu').getByRole('menu')
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await expectNoA11yViolations(page)
    await menu.getByTestId('mailbox-action-show').press('Enter')

    await expect(hidden).not.toHaveAttribute('data-hidden')
    await expect(mailbox.showHiddenFoldersButton).toBeHidden()
  })

  test('MBX-30 a member of a team mailbox gets the actions their rights allow', async ({
    page,
    user,
    users
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })

    const mailbox = await new LoginPage(page).loginAs(user)
    const menu = await mailbox.openFolderMenu({ name: team.name })

    await expect(menu.getByTestId('mailbox-action-rename')).toBeHidden()
    await expect(menu.getByTestId('mailbox-action-delete')).toBeHidden()
    await expect(menu.getByTestId('mailbox-action-hide')).toBeVisible()
  })
})
