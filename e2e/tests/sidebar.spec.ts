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
})
