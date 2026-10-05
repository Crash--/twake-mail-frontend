import { ComposerPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('LST email list rows', () => {
  test('LST-01 a row with labels stays on one line, chips before the subject', async ({
    page,
    user,
    jmap
  }) => {
    const label = await jmap.createLabel('Design', '#1f9d3a')
    await jmap.sendEmail({
      to: user.email,
      subject: 'Labelled row',
      text: 'A body that gives the row a preview'
    })
    const email = await jmap.waitForEmail({ subject: 'Labelled row' })
    await jmap.setKeywords(email.id, { [label.keyword]: true })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Labelled row')
    await expect(row.getByTestId('label-chip')).toBeVisible()

    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have several lines'
    )
    const rowBox = await row.boundingBox()
    const chipBox = await row.getByTestId('label-chip').boundingBox()
    const subjectBox = await row
      .getByTestId('email-list-item-subject')
      .boundingBox()
    const previewBox = await row
      .getByTestId('email-list-item-preview')
      .boundingBox()
    expect(rowBox?.height).toBeLessThan(60)
    expect(chipBox?.x).toBeLessThan(subjectBox?.x ?? 0)
    expect(Math.abs((chipBox?.y ?? 0) - (subjectBox?.y ?? 99))).toBeLessThan(12)
    expect(Math.abs((previewBox?.y ?? 0) - (subjectBox?.y ?? 99))).toBeLessThan(
      8
    )
    await expectNoA11yViolations(page)
  })

  test('LST-02 the actions replace the date on hover and on keyboard focus', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Hover me', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Hover me' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Hover me')
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have no hover actions'
    )
    // The opacity is on the group of actions, and on the box around the date
    const remove = row.getByTestId('email-list-item-remove').locator('..')
    const date = row.getByTestId('email-list-item-date').locator('..')

    await page.mouse.move(0, 0)
    await expect(remove).toHaveCSS('opacity', '0')
    await expect(date).toHaveCSS('opacity', '1')
    await row.hover()
    await expect(remove).toHaveCSS('opacity', '1')
    await expect(date).toHaveCSS('opacity', '0')
    await expect(row.getByTestId('email-list-item-toggle-seen')).toBeVisible()
    await expect(row.getByTestId('email-list-item-more')).toBeVisible()

    await page.mouse.move(0, 0)
    await expect(remove).toHaveCSS('opacity', '0')
    await row.getByTestId('email-list-item-toggle-seen').focus()
    await expect(remove).toHaveCSS('opacity', '1')
  })

  test('LST-03 the reply button of a row opens the composer on a reply to it', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Answer me', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Answer me' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Answer me')
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have no reply button'
    )

    const reply = row.getByTestId('email-list-item-reply')
    await expect(reply).toHaveAccessibleName('Reply')
    await reply.click()

    const composer = new ComposerPage(page)
    await expect(composer.subjectInput).toHaveValue('Re: Answer me')
    await composer.deleteDraftButton.click()
  })

  test('LST-04 the hover actions open the email in a tab of its own, and move it', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Elsewhere', text: 'Hi' })
    const email = await jmap.waitForEmail({ subject: 'Elsewhere' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Elsewhere')
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have no hover actions'
    )

    await row.hover()
    const popup = page.waitForEvent('popup')
    await row.getByTestId('email-list-item-open-in-new-tab').click()
    const tab = await popup
    await expect(tab).toHaveURL(new RegExp(`/email/${email.id}$`))
    // Tokens live in memory: a new tab signs in again (silently with the
    // SSO), then lands on the email
    await expect(tab.getByRole('form', { name: 'Sign In' })).toBeVisible()
    await tab.close()

    await row.hover()
    await row.getByTestId('email-list-item-move').click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('LST-05 the toolbar and the rows have the measures of the design', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Measured', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Measured' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have other measures'
    )
    const row = mailbox.emailRow('Measured')
    const box = async (locator: ReturnType<typeof row.locator>) => {
      const found = await locator.boundingBox()
      expect(found).not.toBeNull()
      return found ?? { x: 0, y: 0, width: 0, height: 0 }
    }

    const toolbar = page.getByTestId('list-toolbar')
    const rowBox = await box(row)
    const toolbarBox = await box(toolbar)
    const refresh = await box(page.getByTestId('list-refresh-button'))
    const selectAll = await box(page.getByTestId('list-select-all-button'))
    // 16 px on each side of the list; 16 px above and below the 32 px buttons
    expect(rowBox.x).toBe(toolbarBox.x)
    expect(refresh.width).toBe(32)
    expect(refresh.height).toBe(32)
    expect(selectAll.height).toBe(32)
    expect(refresh.y - toolbarBox.y).toBe(16)
    expect(selectAll.x - (refresh.x + refresh.width)).toBe(16)
    // 6 px above and below 32 px icon buttons
    expect(rowBox.height).toBeGreaterThanOrEqual(43.5)
    expect(rowBox.height).toBeLessThanOrEqual(44.5)
    for (const id of [
      'email-list-item-checkbox',
      'email-list-item-star',
      'email-list-item-reply'
    ]) {
      const found = await box(row.getByTestId(id))
      expect([found.width, found.height]).toEqual([32, 32])
    }
    // 20 px marker frame, then the 198 px block of the sender, 4 px apart
    const avatar = await box(row.getByTestId('email-list-item-avatar'))
    expect([avatar.width, avatar.height]).toEqual([20, 20])
  })
})
