import type { Locator } from '@playwright/test'

import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('SBR sidebar rows and compose button', () => {
  test('SBR-01 the selected row covers the whole row, 36 px high at least', async ({
    page,
    user,
    jmap
  }) => {
    const work = await jmap.createMailbox({ name: 'Work' })
    await jmap.createMailbox({ name: 'Clients', parentId: work.id })
    const mailbox = await new LoginPage(page).loginAs(user)

    const row = mailbox.folder({ role: 'inbox' })
    await expect(row).toHaveAttribute('aria-current', 'page')
    const box = await row.boundingBox()
    const tree = await mailbox.folderTree.boundingBox()
    expect(box).not.toBeNull()
    expect(tree).not.toBeNull()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(36)
    // The 16 px margins of the sidebar on each side
    expect(box?.width ?? 0).toBeGreaterThanOrEqual((tree?.width ?? 0) - 33)

    // The link and the arrow are distinct controls, side by side
    const link = row.getByRole('link')
    const linkBox = await link.boundingBox()
    expect(linkBox?.height ?? 0).toBeGreaterThanOrEqual(36)

    const workRow = mailbox.folder({ name: 'Work' })
    const toggle = workRow.getByTestId('mailbox-expand-button')
    await expect(toggle).toHaveAccessibleName('Expand')
    const name = await workRow.getByTestId('mailbox-item-name').boundingBox()
    const toggleBox = await toggle.boundingBox()
    // The arrow follows the label, not a column before the icon
    expect(toggleBox?.x ?? 0).toBeGreaterThan(name?.x ?? 0)
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(workRow).toHaveAttribute('aria-expanded', 'true')
    await expect(mailbox.folder({ name: 'Clients' })).toBeVisible()

    await expectNoA11yViolations(page)
  })

  test('SBR-02 the compose label fits on one line in French', async ({
    page,
    user
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('lang', 'fr')
    })
    const mailbox = await new LoginPage(page).loginAs(user)

    await expect(mailbox.composeButton).toHaveText('Nouveau message')
    const box = await mailbox.composeButton.boundingBox()
    expect(box?.height ?? 0).toBeLessThan(48)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(39)
  })

  test('SBR-03 the actions of a row take no room and show on hover', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.folder({ role: 'sent' })
    const more = row.getByTestId('mailbox-more-button')

    const wrapper = more.locator('xpath=..')
    await expect(wrapper).toHaveCSS('opacity', '0')
    await row.hover()
    await expect(wrapper).toHaveCSS('opacity', '1')
  })

  test(
    'SBR-04 the system folders come first, the Folders section holds the ones of the user',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.createMailbox({ name: 'Work' })
      await jmap.createLabel('Design', '#21B930')
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.showFolders()

      const top = async (locator: Locator): Promise<number> =>
        (await locator.boundingBox())?.y ?? Number.NaN
      const archive = await top(mailbox.folder({ role: 'archive' }))
      const title = await top(page.getByTestId('mailbox-tree-title'))
      const work = await top(mailbox.folder({ name: 'Work' }))
      const labels = await top(page.getByTestId('labels-section-toggle'))
      expect(archive).toBeLessThan(title)
      expect(title).toBeLessThan(work)
      expect(work).toBeLessThan(labels)
      await expect(mailbox.folderTree).toContainText('Inbox')
      await expect(mailbox.folderTree).not.toContainText('Work')
      await expect(mailbox.foldersTree).toContainText('Work')
      await expectNoA11yViolations(page)
    }
  )

  test(
    'SBR-05 a hidden folder keeps its whole name and says it is hidden without colour',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.createMailbox({ name: 'A rarely used folder' })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.runFolderAction({ name: 'A rarely used folder' }, 'hide')
      await mailbox.showFolders()
      await mailbox.showHiddenFoldersButton.click()

      const row = mailbox.folder({ name: 'A rarely used folder' })
      await expect(row).toHaveAttribute('data-hidden', 'true')
      // The word is for assistive technology; the icon is the visible sign
      await expect(row.getByTestId('mailbox-item-hidden')).toHaveText('hidden')
      await expect(row.getByRole('link')).toHaveAccessibleName(
        /A rarely used folder\s+hidden/
      )
      const name = row.getByTestId('mailbox-item-name')
      const isCut = await name.evaluate(el => el.scrollWidth > el.clientWidth)
      expect(isCut).toBe(false)
      await expectNoA11yViolations(page)
    }
  )

  test('SBR-06 "Clean" empties the Spam from its row', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'junk to clean',
      text: 'x',
      saveTo: 'junk'
    })
    await jmap.waitForEmail({ subject: 'junk to clean', mailboxRole: 'junk' })
    const mailbox = await new LoginPage(page).loginAs(user)

    const spam = mailbox.folder({ role: 'junk' })
    const clean = spam.getByTestId('mailbox-clean-button')
    await expect(clean).toHaveAccessibleName('Clean')
    await expect(clean).toHaveAccessibleDescription('Delete all spam emails')
    await expect(
      mailbox.folder({ role: 'sent' }).getByTestId('mailbox-clean-button')
    ).toHaveCount(0)
    await spam.hover()
    await clean.click()
    await mailbox.confirmDialog
      .getByRole('button', { name: 'Delete all' })
      .click()
    await expect(mailbox.toast).toContainText(
      'All messages have been deleted forever'
    )
    await expect(clean).toHaveCount(0)
  })

  test('SBR-07 the folder search is the field of the design system, flat, 40 px high', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.folderSearchButton.click()

    const field = mailbox.folderSearch.locator('.MuiPaper-root').first()
    await expect(field).toHaveCSS('box-shadow', 'none')
    await expect(field).toHaveCSS('height', '40px')
  })
})
