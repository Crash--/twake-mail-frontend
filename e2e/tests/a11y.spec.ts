import type { Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expect, test } from '../support/fixtures'

/** Presses Tab (or `key`) until the focused element matches `selector`; fails after `max` presses */
async function tabTo(
  page: Page,
  selector: string,
  key: 'Tab' | 'Shift+Tab' = 'Tab',
  max = 40
): Promise<void> {
  for (let presses = 0; presses < max; presses += 1) {
    if (await page.evaluate(sel => document.activeElement?.matches(sel) ?? false, selector)) {
      return
    }
    await page.keyboard.press(key)
  }
  throw new Error(`${selector} not reached with ${max} Tab presses`)
}

test.describe('A11Y accessibility', () => {
  test('A11Y-01 login, open a folder, read an email and go back with the keyboard only', async ({
    page,
    user,
    jmap
  }) => {
    // Sent to oneself: in the Inbox and, as the sent copy, in Sent
    await jmap.sendEmail({ to: user.email, subject: 'first sent', text: 'hello' })
    await jmap.waitForEmail({ subject: 'first sent' })
    await jmap.sendEmail({ to: user.email, subject: 'keyboard email', text: 'Read me' })
    await jmap.waitForEmail({ subject: 'keyboard email' })

    const login = await new LoginPage(page).goto()
    await tabTo(page, '[data-testid="login-username-input"]')
    await page.keyboard.type(user.email)
    await page.keyboard.press('Tab')
    await expect(login.passwordInput).toBeFocused()
    await page.keyboard.type(user.password)
    await page.keyboard.press('Enter')

    await page.waitForURL(/\/mailbox\//)

    // The Sent folder of the tree, then back to the Inbox
    await tabTo(page, '[data-mailbox-role="sent"] a')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('email-list-item').filter({ hasText: 'first sent' })).toBeVisible()
    await tabTo(page, '[data-mailbox-role="inbox"] a')
    await page.keyboard.press('Enter')

    // The rows are links: Tab reaches the list, the arrows move between rows
    const newest = page.getByTestId('email-list-item').filter({ hasText: 'keyboard email' })
    const row = page.getByTestId('email-list-item').filter({ hasText: 'first sent' })
    await expect(newest).toBeVisible()
    await tabTo(page, '[data-testid="email-list-item"] [data-row-focus]')
    await expect(newest.locator('[data-row-focus]')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(row.locator('[data-row-focus]')).toBeFocused()
    await page.keyboard.press('Enter')

    // The email replaces the list: the focus moves to its subject
    const view = page.getByTestId('email-view')
    await expect(view.getByTestId('email-view-subject')).toHaveText('first sent')
    await expect(view.getByTestId('email-view-subject')).toBeFocused()
    await expect(
      view.getByTestId('email-view-body').contentFrame().locator('body')
    ).toContainText('hello')

    // The back button is before the subject
    await tabTo(page, '[data-testid="email-view-back-button"]', 'Shift+Tab')
    await page.keyboard.press('Enter')
    await expect(view).toBeHidden()
    // Back on the list, the focus returns to the email that was open
    await expect(row.locator('[data-row-focus]')).toBeFocused()
  })
})
