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
