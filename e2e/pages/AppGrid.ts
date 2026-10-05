import { expect, type Locator, type Page } from '@playwright/test'

import { MailboxPage } from './MailboxPage'

/**
 * The app grid of the top bar (in the folder drawer on phones).
 * Patrol counterparts: robots/app_grid_robot.dart, robots/mobile/mobile_app_grid_robot.dart.
 */
export class AppGrid {
  readonly page: Page
  readonly toggleButton: Locator
  readonly list: Locator
  readonly items: Locator

  constructor(page: Page) {
    this.page = page
    this.toggleButton = page.getByTestId('app-grid-toggle-button')
    this.list = page.getByTestId('app-grid-list')
    this.items = this.list.getByTestId('app-grid-item')
  }

  /** On a phone the button is in the folder drawer */
  async open(): Promise<AppGrid> {
    const mailbox = new MailboxPage(this.page)
    if (!(await this.toggleButton.isVisible())) await mailbox.showFolders()
    await this.toggleButton.click()
    await expect(this.list.getByRole('menu')).toBeVisible()
    return this
  }

  item(name: string): Locator {
    return this.items.filter({ hasText: name })
  }

  /** Opens an app: a new tab, given back */
  async launch(name: string): Promise<Page> {
    const popup = this.page.waitForEvent('popup')
    await this.item(name).click()
    return popup
  }
}
