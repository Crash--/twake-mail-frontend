import type { Locator } from '@playwright/test'

import { LoginPage, SettingsPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

const FILTER = 'com:linagora:params:jmap:filter'

test.describe('MBX folder menu', () => {
  test(
    'MBX-50 "Move folder content" moves every email to another folder, and Undo puts them back',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const source = await jmap.createMailbox({ name: 'Bulk source' })
      const target = await jmap.createMailbox({ name: 'Bulk target' })
      for (const subject of ['bulk one', 'bulk two', 'bulk three']) {
        await jmap.createEmailIn(source.id, { subject })
      }

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.runFolderAction(
        { name: 'Bulk source' },
        'move-content'
      )
      await expectNoA11yViolations(page)
      await mailbox.pickFolder('Bulk target')

      await expect(mailbox.toast).toContainText('Moved to Bulk target')
      await expect
        .poll(async () => (await jmap.queryEmails({ inMailbox: target.id })).length)
        .toBe(3)
      expect(await jmap.queryEmails({ inMailbox: source.id })).toHaveLength(0)

      await mailbox.toastUndoButton.click()
      await expect
        .poll(async () => (await jmap.queryEmails({ inMailbox: source.id })).length)
        .toBe(3)
      expect(await jmap.queryEmails({ inMailbox: target.id })).toHaveLength(0)
    }
  )

  test('MBX-51 a folder with more emails than one batch is moved whole, the destination being Spam marks them read', async ({
    page,
    user,
    jmap
  }) => {
    const source = await jmap.createMailbox({ name: 'Many emails' })
    const spam = await jmap.findMailboxByRole('junk')
    for (let first = 0; first < 55; first += 5) {
      await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          jmap.createEmailIn(source.id, {
            subject: `many ${first + index}`,
            keywords: {}
          })
        )
      )
    }

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.runFolderAction({ name: 'Many emails' }, 'move-content')
    await mailbox.pickFolder('Spam')

    await expect(mailbox.toast).toContainText('Moved to Spam')
    await expect
      .poll(async () => (await jmap.queryEmails({ inMailbox: spam.id }, 100)).length)
      .toBe(55)
    expect(await jmap.queryEmails({ inMailbox: source.id })).toHaveLength(0)
    const moved = await jmap.queryEmails({ inMailbox: spam.id }, 100)
    expect(moved.every(email => '$seen' in email.keywords)).toBe(true)
  })

  test('MBX-52 an empty folder does not offer to move its content', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.createMailbox({ name: 'Nothing inside' })
    const mailbox = await new LoginPage(page).loginAs(user)

    const menu = await mailbox.openFolderMenu({ name: 'Nothing inside' })
    await expect(menu.getByTestId('mailbox-action-move-content')).toBeHidden()
    await expect(menu.getByTestId('mailbox-action-create-filter')).toBeVisible()
  })

  test(
    'MBX-53 "Create filter" opens the rule creator moving to the folder, and saves the rule',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const folder = await jmap.createMailbox({ name: 'Filtered' })
      const mailbox = await new LoginPage(page).loginAs(user)

      await mailbox.runFolderAction({ name: 'Filtered' }, 'create-filter')
      const dialog = new SettingsPage(page).ruleDialog
      await expect(dialog).toBeVisible()
      await expect(dialog.getByTestId('rule-action-folder-button')).toContainText(
        'Filtered'
      )
      await expectNoA11yViolations(page)
      await dialog.getByTestId('rule-name-input').fill('Filtered rule')
      await dialog
        .getByTestId('rule-condition-value-input')
        .fill('boss@example.com')
      await dialog.getByTestId('create-rule-button').click()

      await expect(dialog).toBeHidden()
      await expect(mailbox.toast).toContainText('New filter was created')
      await expect
        .poll(async () => {
          const result = await jmap.call('Filter/get', { ids: ['singleton'] }, [
            FILTER
          ])
          return (result.list as { rules: unknown[] }[])[0]?.rules
        })
        .toEqual([
          expect.objectContaining({
            name: 'Filtered rule',
            action: expect.objectContaining({
              appendIn: { mailboxIds: [folder.id] }
            })
          })
        ])
    }
  )

  test('MBX-54 "Open in new tab" is a link to the folder that opens in a new tab', async ({
    page,
    user,
    jmap
  }) => {
    const folder = await jmap.createMailbox({ name: 'Elsewhere' })
    const mailbox = await new LoginPage(page).loginAs(user)

    const menu = await mailbox.openFolderMenu({ name: 'Elsewhere' })
    const link = menu.getByTestId('mailbox-action-open-in-new-tab')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute(
      'href',
      `/mailbox/${encodeURIComponent(folder.id)}`
    )
    const opened = page.context().waitForEvent('page')
    await link.click()

    // The credentials of a basic login live in the memory of the first tab,
    // which hands them over to the new one: no sign-in asked
    const tab = await opened
    await tab.waitForLoadState()
    expect(tab.url()).toContain(new URL(page.url()).origin)
    await expect(tab.getByTestId('mailbox-page')).toBeVisible()
    await expect(tab.getByTestId('login-username-input')).toHaveCount(0)
  })

  test(
    'MBX-55 the unread count is hidden on Trash and Drafts, which shows how many emails it holds',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const trash = await jmap.findMailboxByRole('trash')
      const drafts = await jmap.findMailboxByRole('drafts')
      const work = await jmap.createMailbox({ name: 'Work unread' })
      await jmap.createEmailIn(trash.id, { subject: 'in trash', keywords: {} })
      await jmap.createEmailIn(drafts.id, { subject: 'a draft', keywords: {} })
      await jmap.createEmailIn(work.id, { subject: 'to read', keywords: {} })

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.showFolders()

      await expect(mailbox.folderUnreadCount({ name: 'Work unread' })).toHaveText('1')
      await expect(mailbox.folderUnreadCount({ role: 'trash' })).toBeHidden()
      await expect(mailbox.folderUnreadCount({ role: 'drafts' })).toBeHidden()
      await expect(
        mailbox.folder({ role: 'drafts' }).getByTestId('mailbox-total-count')
      ).toHaveText('1')
    }
  )

  test(
    'MBX-56 the title of the Folders section collapses and expands it, and the choice is kept',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.createMailbox({ name: 'Projects' })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.showFolders()
      await expect(mailbox.foldersTree).toBeVisible()
      await expect(mailbox.foldersSectionToggle).toHaveAttribute(
        'aria-expanded',
        'true'
      )

      await mailbox.foldersSectionToggle.click()
      await expect(mailbox.foldersSectionToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      // The title folds the folders of the user, not the system ones
      await expect(mailbox.foldersTree).toBeHidden()
      await expect(mailbox.folder({ role: 'inbox' })).toBeVisible()
      await expect(mailbox.addFolderButton).toBeVisible()
      await expectNoA11yViolations(page)

      // Closing and opening the drawer, or changing folder, keeps it
      if (mailbox.hasFolderDrawer()) {
        await mailbox.hideFolders()
        await mailbox.folderMenuButton.click()
        await expect(mailbox.folderDrawer).toBeVisible()
      }
      await expect(mailbox.foldersSectionToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      await mailbox.foldersSectionToggle.focus()
      await page.keyboard.press('Enter')
      await expect(mailbox.foldersTree).toBeVisible()
      await expect(mailbox.folder({ role: 'inbox' })).toBeVisible()
    }
  )
})

// Dragging is a pointer gesture of the desktop: the keyboard way is "Move
// folder" in the folder menu (MBX folder menu above)
test.describe('MBX folders dragged in the tree', () => {
  test('MBX-57 a folder dragged onto another moves under it, and Undo puts it back', async ({
    page,
    user,
    jmap
  }) => {
    const work = await jmap.createMailbox({ name: 'Work' })
    const projects = await jmap.createMailbox({ name: 'Projects' })
    const parentOf = async (id: string): Promise<string | null | undefined> =>
      (await jmap.getMailboxes()).find(mailbox => mailbox.id === id)?.parentId

    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.folder({ role: 'inbox' })).not.toHaveAttribute(
      'draggable'
    )
    await mailbox
      .folder({ name: 'Projects' })
      .getByTestId('mailbox-item-name')
      .dragTo(mailbox.folder({ name: 'Work' }).getByTestId('mailbox-item-name'))

    await expect(mailbox.toast).toContainText('Moved to Work')
    await expect.poll(() => parentOf(projects.id)).toBe(work.id)
    // Work has a subfolder now: it expands
    await expect(mailbox.folder({ id: work.id })).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    await mailbox.toastUndoButton.click()
    await expect.poll(() => parentOf(projects.id)).toBe(null)
    await expect(mailbox.folder({ id: work.id })).not.toHaveAttribute(
      'aria-expanded'
    )
  })

  test('MBX-58 a folder is not taken by itself, one of its subfolders, its parent, nor a folder holding one of its name', async ({
    page,
    user,
    jmap
  }) => {
    const work = await jmap.createMailbox({ name: 'Work' })
    const clients = await jmap.createMailbox({
      name: 'Clients',
      parentId: work.id
    })
    const projects = await jmap.createMailbox({ name: 'Projects' })
    await jmap.createMailbox({ name: 'Clients', parentId: projects.id })
    const parentOf = async (id: string): Promise<string | null | undefined> =>
      (await jmap.getMailboxes()).find(mailbox => mailbox.id === id)?.parentId

    const mailbox = await new LoginPage(page).loginAs(user)
    for (const parent of [work, projects]) {
      const folder = mailbox.folder({ id: parent.id })
      if ((await folder.getAttribute('aria-expanded')) === 'false') {
        await mailbox.toggleFolder({ id: parent.id })
      }
    }
    const row = (id: string): Locator =>
      mailbox.folder({ id }).getByTestId('mailbox-item-name')
    /** Drags `source` over `target`: whether the target shows it takes it, then drops */
    const isTakenBy = async (
      source: Locator,
      target: Locator
    ): Promise<boolean> => {
      const from = await source.boundingBox()
      const to = await target.boundingBox()
      if (from === null || to === null) throw new Error('A row is not shown')
      await page.mouse.move(from.x + 5, from.y + from.height / 2)
      await page.mouse.down()
      await page.mouse.move(from.x + 15, from.y + from.height / 2, { steps: 3 })
      await page.mouse.move(to.x + 5, to.y + to.height / 2, { steps: 5 })
      const isOver =
        (await page.locator('[data-drop-over]').count()) > 0
      await page.mouse.up()
      return isOver
    }

    // Itself, one of its subfolders, its parent, a folder holding a "Clients"
    expect(await isTakenBy(row(work.id), row(work.id))).toBe(false)
    expect(await isTakenBy(row(work.id), row(clients.id))).toBe(false)
    expect(await isTakenBy(row(clients.id), row(work.id))).toBe(false)
    expect(await isTakenBy(row(clients.id), row(projects.id))).toBe(false)
    // The check itself: a folder that takes it shows so, and the drop moves it
    expect(await isTakenBy(row(work.id), row(projects.id))).toBe(true)
    await expect(mailbox.toast).toContainText('Moved to Projects')
    await mailbox.toastUndoButton.click()

    await expect.poll(() => parentOf(work.id)).toBe(null)
    expect(await parentOf(clients.id)).toBe(work.id)
  })
})

// Sub-addressing (TF-3189): user+Folder@domain lands in the folder when
// anyone may post there; the e2e James runs the TMailSubAdressing mailet
test.describe('MBX sub-addressing of a folder', () => {
  test('MBX-59 sub-addressing is allowed from the folder menu, the subaddress copied, mail to it lands in the folder until disallowed', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const projects = await jmap.createMailbox({ name: 'Projects' })
    const mongolia = await jmap.createMailbox({
      name: 'Mongolia',
      parentId: projects.id
    })
    const alice = await users.create({ prefix: 'alice' })
    const at = user.email.indexOf('@')
    const address = `${user.email.slice(0, at)}+Projects.Mongolia${user.email.slice(at)}`
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.toggleFolder({ id: projects.id })
    let menu = await mailbox.openFolderMenu({ id: mongolia.id })
    await expect(menu.getByTestId('mailbox-action-copy-subaddress')).toHaveCount(0)
    await menu.getByTestId('mailbox-action-allow-subaddressing').click()

    const dialog = page.getByTestId('subaddressing-dialog')
    await expect(dialog).toContainText('"Mongolia"')
    await expect(dialog.getByTestId('subaddressing-address')).toHaveText(address)
    await expectNoA11yViolations(page)
    await dialog.getByTestId('subaddressing-copy-button').click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      address
    )
    await dialog.getByTestId('subaddressing-allow-button').click()
    await expect(mailbox.toast).toContainText(
      'You have successfully allowed subaddressing for this folder'
    )

    // Mail to the subaddress lands in the folder
    await jmapFor(alice).sendEmail({
      to: address,
      subject: 'To Mongolia',
      text: 'Straight in'
    })
    await jmap.waitForEmail({ mailboxId: mongolia.id, subject: 'To Mongolia' })

    menu = await mailbox.openFolderMenu({ id: mongolia.id })
    await menu.getByTestId('mailbox-action-copy-subaddress').click()
    await expect(mailbox.toast).toContainText(
      'Email subaddress copied to clipboard'
    )
    await mailbox.runFolderAction({ id: mongolia.id }, 'disallow-subaddressing')
    await expect(mailbox.toast).toContainText(
      'You have successfully disallowed subaddressing for this folder'
    )
    menu = await mailbox.openFolderMenu({ id: mongolia.id })
    await expect(
      menu.getByTestId('mailbox-action-allow-subaddressing')
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Disallowed: it lands in the Inbox again
    await jmapFor(alice).sendEmail({
      to: address,
      subject: 'Back to Inbox',
      text: 'Not in the folder'
    })
    await jmap.waitForEmail({ subject: 'Back to Inbox' })
  })
})
