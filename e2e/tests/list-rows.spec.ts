import { LoginPage } from '../pages'
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
})
