import { expect, type Page } from '@playwright/test'

/** A page, a frame or a frame locator: where the test ids are looked up */
type Scope = Pick<Page, 'getByTestId'>

/**
 * Without the platform of Twake Workplace, as tmail-flutter, "Manage
 * account" (`settings-button`) and "Sign out" (`logout-button`) are behind
 * the initial of the user at the end of the bar: opens that menu when it
 * is there. Elsewhere (the drawer, the search row) they are shown as they are.
 */
export async function openAccountMenuIfAny(
  scope: Scope
): Promise<void> {
  const button = scope.getByTestId('account-menu-button')
  if (await button.isVisible()) await button.click()
}

/**
 * Shows "Manage account" (`settings-button`) wherever it is: behind the
 * initial of the user (a desktop without the platform), in the folder
 * drawer (phones and tablets without the platform), or in sight
 */
export async function revealSettingsButton(
  scope: Scope
): Promise<void> {
  await openAccountMenuIfAny(scope)
  if (await scope.getByTestId('settings-button').isVisible()) return
  // An email read on a phone or a tablet hides the bar of the mail
  const back = scope.getByTestId('email-view-back-button')
  const menu = scope.getByTestId('mobile-mailbox-menu-button')
  if (!(await menu.isVisible()) && (await back.isVisible())) {
    await back.click()
    await expect(menu).toBeVisible()
  }
  if (await menu.isVisible()) {
    await menu.click()
    await expect(scope.getByTestId('settings-button')).toBeVisible()
  }
}
