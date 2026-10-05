import type { Page } from '@playwright/test'

import { LoginPage, MailboxPage } from '../pages'
import { expect, test } from '../support/fixtures'

/** Presses Tab (or `key`) until the focused element matches `selector`; fails after `max` presses */
async function tabTo(
  page: Page,
  selector: string,
  key: 'Tab' | 'Shift+Tab' = 'Tab',
  max = 40
): Promise<void> {
  for (let presses = 0; presses < max; presses += 1) {
    if (
      await page.evaluate(
        sel => document.activeElement?.matches(sel) ?? false,
        selector
      )
    ) {
      return
    }
    await page.keyboard.press(key)
  }
  throw new Error(`${selector} not reached with ${max} Tab presses`)
}

/** True when the focused element is inside the element matching `selector` */
async function isFocusIn(page: Page, selector: string): Promise<boolean> {
  return page.evaluate(
    sel =>
      document.querySelector(sel)?.contains(document.activeElement) ?? false,
    selector
  )
}

/**
 * Opens a folder of the tree with the keyboard. Below the desktop size the
 * tree is in a drawer: the menu button opens it with the focus inside, kept
 * there by Tab; choosing a folder closes it and gives the focus back to the
 * menu button.
 */
async function openFolderWithKeyboard(
  page: Page,
  mailbox: MailboxPage,
  role: string
): Promise<void> {
  const hasDrawer = mailbox.hasFolderDrawer()
  if (hasDrawer) {
    await tabTo(page, '[data-testid="mobile-mailbox-menu-button"]')
    await page.keyboard.press('Enter')
    await expect(mailbox.folderDrawer).toBeVisible()
    await expect
      .poll(() => isFocusIn(page, '[data-testid="mailbox-drawer"]'))
      .toBe(true)
  }
  await tabTo(page, `[data-mailbox-role="${role}"] a`)
  if (hasDrawer) {
    expect(await isFocusIn(page, '[data-testid="mailbox-drawer"]')).toBe(true)
  }
  await page.keyboard.press('Enter')
  if (hasDrawer) {
    await expect(mailbox.folderDrawer).toBeHidden()
    await expect(mailbox.folderMenuButton).toBeFocused()
  }
}

test.describe('A11Y accessibility', () => {
  // The reading view of a single email: the "Thread" setting off
  test.use({ emailsOneByOne: true })

  test('A11Y-01 login, open a folder, read an email and go back with the keyboard only', async ({
    page,
    user,
    jmap
  }) => {
    // Sent to oneself: in the Inbox and, as the sent copy, in Sent
    await jmap.sendEmail({
      to: user.email,
      subject: 'first sent',
      text: 'hello'
    })
    await jmap.waitForEmail({ subject: 'first sent' })
    await jmap.sendEmail({
      to: user.email,
      subject: 'keyboard email',
      text: 'Read me'
    })
    await jmap.waitForEmail({ subject: 'keyboard email' })

    const login = await new LoginPage(page).goto()
    await tabTo(page, '[data-testid="login-username-input"]')
    await page.keyboard.type(user.email)
    await page.keyboard.press('Tab')
    await expect(login.passwordInput).toBeFocused()
    await page.keyboard.type(user.password)
    await page.keyboard.press('Enter')

    await page.waitForURL(/\/mailbox\//)

    // The Sent folder of the tree, then back to the Inbox (in the drawer on
    // phones and tablets)
    const mailbox = new MailboxPage(page)
    await openFolderWithKeyboard(page, mailbox, 'sent')
    await expect(
      page.getByTestId('email-list-item').filter({ hasText: 'first sent' })
    ).toBeVisible()
    await openFolderWithKeyboard(page, mailbox, 'inbox')

    // The rows are links: Tab reaches the list, the arrows move between rows
    const newest = page
      .getByTestId('email-list-item')
      .filter({ hasText: 'keyboard email' })
    const row = page
      .getByTestId('email-list-item')
      .filter({ hasText: 'first sent' })
    await expect(newest).toBeVisible()
    await tabTo(page, '[data-testid="email-list-item"] [data-row-focus]')
    await expect(newest.locator('[data-row-focus]')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(row.locator('[data-row-focus]')).toBeFocused()
    await page.keyboard.press('Enter')

    // The email replaces the list: the focus moves to its subject
    const view = page.getByTestId('email-view')
    await expect(view.getByTestId('email-view-subject')).toHaveText(
      'first sent'
    )
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
