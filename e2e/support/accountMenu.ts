import type { FrameLocator, Page } from '@playwright/test'

/**
 * Without the platform of Twake Workplace, as tmail-flutter, "Manage
 * account" (`settings-button`) and "Sign out" (`logout-button`) are behind
 * the initial of the user at the end of the bar: opens that menu when it
 * is there. Elsewhere (the drawer, the search row) they are shown as they are.
 */
export async function openAccountMenuIfAny(
  scope: Page | FrameLocator
): Promise<void> {
  const button = scope.getByTestId('account-menu-button')
  if (await button.isVisible()) await button.click()
}
