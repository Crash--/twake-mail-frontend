import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('TRE folder tree keyboard (WAI-ARIA tree view)', () => {
  test(
    'TRE-01 each tree is one tab stop, on the selected folder, and the arrows move between the visible folders',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const inbox = await jmap.findMailboxByRole('inbox')
      await jmap.createMailbox({ name: 'Newsletters', parentId: inbox.id })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.showFolders()
      await mailbox.toggleFolder({ role: 'inbox' })

      // One tab stop per tree: the selected folder (the Inbox)
      await expect(mailbox.treeTabStops(mailbox.folderTree)).toHaveCount(1)
      await expect(mailbox.treeTabStops(mailbox.folderTree)).toHaveAttribute(
        'data-mailbox-role',
        'inbox'
      )
      // Whatever its links and buttons: the other rows have none in the tab sequence
      await expect(
        mailbox.folderTree.locator(
          '[role="treeitem"][tabindex="-1"] :is(a, button)[tabindex="0"]'
        )
      ).toHaveCount(0)
      await expect(
        mailbox.folderTree.locator('a[href]:not([tabindex="-1"])')
      ).toHaveCount(0)

      await mailbox.focusFolder({ role: 'inbox' })
      // Down: the subfolder, then Starred (after the whole subtree), then Drafts
      await page.keyboard.press('ArrowDown')
      await mailbox.expectFolderFocused({ name: 'Newsletters' })
      await page.keyboard.press('ArrowDown')
      await mailbox.expectFolderFocused({ name: 'Starred' })
      await page.keyboard.press('ArrowDown')
      await mailbox.expectFolderFocused({ role: 'drafts' })
      await page.keyboard.press('ArrowUp')
      await mailbox.expectFolderFocused({ name: 'Starred' })
      // The focused row is the tab stop, the others are not
      await expect(mailbox.treeTabStops(mailbox.folderTree)).toHaveCount(1)
      await expect(mailbox.folder({ name: 'Starred' })).toHaveAttribute(
        'tabindex',
        '0'
      )

      await page.keyboard.press('End')
      await mailbox.expectFolderFocused({ role: 'archive' })
      await page.keyboard.press('ArrowDown')
      await mailbox.expectFolderFocused({ role: 'archive' })
      await page.keyboard.press('Home')
      await mailbox.expectFolderFocused({ role: 'inbox' })
      await page.keyboard.press('ArrowUp')
      await mailbox.expectFolderFocused({ role: 'inbox' })
      await expectNoA11yViolations(page)
    }
  )

  test(
    'TRE-02 Right expands a folder then goes to its first child, Left goes to the parent then collapses, Enter opens the folder',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const work = await jmap.createMailbox({ name: 'Work' })
      const clients = await jmap.createMailbox({
        name: 'Clients',
        parentId: work.id
      })
      await jmap.createMailbox({ name: 'Acme', parentId: clients.id })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.focusFolder({ name: 'Work' })
      const work_ = mailbox.folder({ name: 'Work' })
      await expect(work_).toHaveAttribute('aria-expanded', 'false')

      await page.keyboard.press('ArrowRight')
      await expect(work_).toHaveAttribute('aria-expanded', 'true')
      // Expanding does not move the focus
      await mailbox.expectFolderFocused({ name: 'Work' })
      await page.keyboard.press('ArrowRight')
      await mailbox.expectFolderFocused({ name: 'Clients' })
      const clientsRow = mailbox.folder({ name: 'Clients' })
      await expect(clientsRow).toHaveAttribute('aria-level', '2')
      await expect(clientsRow).toHaveAttribute('aria-posinset', '1')
      await expect(clientsRow).toHaveAttribute('aria-setsize', '1')
      await page.keyboard.press('ArrowRight')
      await expect(clientsRow).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('ArrowRight')
      await mailbox.expectFolderFocused({ name: 'Acme' })
      await expect(mailbox.folder({ name: 'Acme' })).toHaveAttribute(
        'aria-level',
        '3'
      )
      // A leaf: Right does nothing
      await page.keyboard.press('ArrowRight')
      await mailbox.expectFolderFocused({ name: 'Acme' })

      // Left: the parent, then collapses it, then the parent again
      await page.keyboard.press('ArrowLeft')
      await mailbox.expectFolderFocused({ name: 'Clients' })
      await page.keyboard.press('ArrowLeft')
      await expect(clientsRow).toHaveAttribute('aria-expanded', 'false')
      await mailbox.expectFolderFocused({ name: 'Clients' })
      await expect(mailbox.folder({ name: 'Acme' })).toBeHidden()
      await page.keyboard.press('ArrowLeft')
      await mailbox.expectFolderFocused({ name: 'Work' })
      await page.keyboard.press('ArrowLeft')
      await expect(work_).toHaveAttribute('aria-expanded', 'false')
      await expect(clientsRow).toBeHidden()

      // Enter opens the folder (the drawer closes on a small screen)
      await page.keyboard.press('Enter')
      await expect(mailbox.root).toHaveAttribute('data-mailbox-id', work.id)
      await mailbox.expectFolderSelected({ name: 'Work' })
      await expectNoA11yViolations(page)
    }
  )

  test(
    'TRE-03 the actions of the focused folder stay reachable: Tab to its arrow and menu button, Shift+F10 and the menu key',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const work = await jmap.createMailbox({ name: 'Work' })
      await jmap.createMailbox({ name: 'Clients', parentId: work.id })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.focusFolder({ name: 'Work' })
      const row = mailbox.folder({ name: 'Work' })

      await page.keyboard.press('Tab')
      await expect(row.getByTestId('mailbox-expand-button')).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(row).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('Tab')
      await expect(row.getByTestId('mailbox-more-button')).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Shift+Tab')
      await mailbox.expectFolderFocused({ name: 'Work' })

      // The menu key and Shift+F10 open the menu of the focused row
      const menu = page.getByTestId('mailbox-context-menu').getByRole('menu')
      await page.keyboard.press('Shift+F10')
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('menuitem').first()).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await mailbox.expectFolderFocused({ name: 'Work' })
      await page.keyboard.press('ContextMenu')
      await expect(menu).toBeVisible()
      await page.keyboard.press('Escape')
      await mailbox.expectFolderFocused({ name: 'Work' })
      // The arrows still work once the menu closed
      await page.keyboard.press('ArrowDown')
      await mailbox.expectFolderFocused({ name: 'Clients' })
    }
  )

  test('TRE-04 the folders of the user, the team mailboxes and the search results are trees of their own', async ({
    page,
    user,
    users,
    jmap
  }) => {
    await jmap.createMailbox({ name: 'Zeta' })
    const team = await users.createTeamMailbox({ members: [user] })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.toggleFolder({ name: team.name })

    // Each section has its tab stop and its own arrows; the arrows stop at its ends
    await expect(mailbox.treeTabStops(mailbox.foldersTree)).toHaveCount(1)
    const teamTree = mailbox.teamMailboxesSection.getByRole('tree')
    await expect(mailbox.treeTabStops(teamTree)).toHaveCount(1)
    await mailbox.focusFolder({ name: 'Zeta' })
    await page.keyboard.press('ArrowDown')
    await mailbox.expectFolderFocused({ name: 'Zeta' })
    await mailbox.focusFolder({ name: team.name })
    await page.keyboard.press('ArrowRight')
    await expect(teamTree.getByRole('treeitem').nth(1)).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await mailbox.expectFolderFocused({ name: team.name })
    await page.keyboard.press('Home')
    await mailbox.expectFolderFocused({ name: team.name })

    // The search results: down from the field, then the arrows of a tree
    await mailbox.searchFolders('zeta')
    await page.keyboard.press('ArrowDown')
    await expect(
      mailbox.folderSearchResults.getByRole('treeitem')
    ).toBeFocused()
    await expectNoA11yViolations(page)
  })

  test(
    'TRE-05 the focus is kept when the focused folder goes away, and Tab leaves the tree',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.createMailbox({ name: 'Alpha' })
      await jmap.createMailbox({ name: 'Beta' })
      await jmap.createMailbox({ name: 'Gamma' })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.focusFolder({ name: 'Beta' })

      await page.keyboard.press('Shift+F10')
      const menu = page.getByTestId('mailbox-context-menu').getByRole('menu')
      await menu.getByTestId('mailbox-action-delete').click()
      await mailbox.confirmDialog
        .getByRole('button', { name: 'Delete' })
        .click()
      await expect(mailbox.folder({ name: 'Beta' })).toBeHidden()

      // It is on a folder of the tree, not on the page
      await expect
        .poll(() => mailbox.focusedFolderName(), {
          message: 'a folder holds the focus'
        })
        .not.toBe('')
      await expect(mailbox.treeTabStops(mailbox.foldersTree)).toHaveCount(1)
      await page.keyboard.press('ArrowDown')
      await expect.poll(() => mailbox.focusedFolderName()).not.toBe('')
    }
  )

  test(
    'TRE-06 a folder removed by a push while it holds the focus hands the focus to a neighbour',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const doomed = await jmap.createMailbox({ name: 'Doomed' })
      await jmap.createMailbox({ name: 'Survivor' })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.focusFolder({ name: 'Doomed' })

      await jmap.destroyMailbox(doomed.id)

      await expect(mailbox.folder({ name: 'Doomed' })).toBeHidden()
      await expect.poll(() => mailbox.focusedFolderName()).not.toBe('')
      await expect(mailbox.treeTabStops(mailbox.foldersTree)).toHaveCount(1)
    }
  )

  test('TRE-08 a folder name cut by the width shows in a tooltip when its row has the keyboard focus, and on hover, without a second description', async ({
    page,
    user,
    jmap
  }) => {
    const name = `A very long folder name that the sidebar cuts ${'x'.repeat(60)}`
    await jmap.createMailbox({ name: 'Zzz' })
    await jmap.createMailbox({ name })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.focusFolder({ name: 'Zzz' })
    // Moved to with the keys, as a keyboard user does (not a focus() of the test)
    await page.keyboard.press('Home')
    await mailbox.expectFolderFocused({ name })

    const tooltip = page.getByRole('tooltip', { name })
    await expect(tooltip).toBeVisible()
    // The name is said once: by the row, whose tooltip is no description
    await expect(mailbox.folder({ name })).not.toHaveAttribute(
      'aria-describedby'
    )
    await expect(
      mailbox.folder({ name }).getByRole('link')
    ).not.toHaveAttribute('aria-describedby')
    await page.keyboard.press('End')
    await expect(tooltip).toBeHidden()
    await mailbox.folder({ name }).hover()
    await expect(tooltip).toBeVisible()
  })

  test('TRE-07 letters jump to the folder starting with them, and the focused folder has a visible ring', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.createMailbox({ name: 'Zeta' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.focusFolder({ role: 'inbox' })

    await page.keyboard.press('s')
    await mailbox.expectFolderFocused({ name: 'Starred' })
    // The same letter again goes on to the next one
    await page.keyboard.press('s')
    await mailbox.expectFolderFocused({ role: 'sent' })
    await page.keyboard.press('ArrowUp')
    await mailbox.expectFolderFocused({ name: 'Outbox' })
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await mailbox.expectFolderFocused({ name: 'Starred' })

    // A row with the keyboard focus is outlined by the theme: a thin line
    // by default, a thick one once the user asks for the enhanced indicator
    const focusOutline = async (): Promise<string> =>
      mailbox.folder({ name: 'Starred' }).evaluate(row => {
        const style = getComputedStyle(row)
        return `${style.outlineWidth} ${style.outlineStyle}`
      })
    expect(await focusOutline()).toBe('1px solid')

    // Escape is left alone; a letter belongs to the tree, whether a folder
    // starts with it or not ("q": none): "c" does not open the composer
    await page.keyboard.press('Escape')
    await page.keyboard.press('q')
    await page.keyboard.press('c')
    await expect(page.getByTestId('composer')).toBeHidden()
    await mailbox.expectFolderFocused({ name: 'Starred' })
    // Punctuation stays for the shortcuts of the page: "/" focuses the search
    await page.keyboard.press('/')
    await expect(page.getByTestId('search-input')).toBeFocused()

    await mailbox.setEnhancedFocus(true)
    await mailbox.focusFolder({ role: 'inbox' })
    await page.keyboard.press('ArrowDown')
    await mailbox.expectFolderFocused({ name: 'Starred' })
    expect(await focusOutline()).toBe('3px solid')
  })
})
