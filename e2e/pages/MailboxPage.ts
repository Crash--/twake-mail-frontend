import { expect, type Locator, type Page } from '@playwright/test'

import type { MailboxRole } from '../support/jmap'
import { ComposerPage } from './ComposerPage'
import { EmailPage } from './EmailPage'

/** A folder of the sidebar, by JMAP role (`inbox`, `trash`...) or by displayed name */
export type FolderRef = { role: MailboxRole } | { name: string }

export type QuickFilter = 'attachments' | 'unread' | 'starred'

/** Below this width the folders are in a drawer (app `SCREEN_BREAKPOINTS.desktop`) */
const DESKTOP_MIN_WIDTH = 1200

/**
 * The mailbox screen: folder tree (sidebar) + email list (thread view).
 * Below the desktop size the tree is in a drawer, opened by the menu button
 * of the top bar and closed once a folder is chosen: the folder methods open
 * it when needed.
 * Patrol counterparts: robots/mailbox_*_robot.dart, robots/thread_robot.dart.
 */
export class MailboxPage {
  readonly page: Page
  /** The mailbox screen, `data-mailbox-id` of the open folder */
  readonly root: Locator
  readonly folderTree: Locator
  /** The top bar button opening the folder drawer, below the desktop size */
  readonly folderMenuButton: Locator
  readonly folderDrawer: Locator
  readonly addFolderButton: Locator
  readonly folderSearchButton: Locator
  readonly emailList: Locator
  readonly emptyListView: Locator
  readonly composeButton: Locator
  readonly userAvatar: Locator
  readonly scrollToTopButton: Locator
  /** The toast at the bottom of the screen ("Moved to Trash", errors) */
  readonly toast: Locator
  readonly toastUndoButton: Locator
  /** The list of the keyboard shortcuts (`?`, account menu) */
  readonly shortcutsDialog: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('mailbox-page')
    this.folderTree = page.getByTestId('mailbox-tree')
    this.folderMenuButton = page.getByTestId('mobile-mailbox-menu-button')
    this.folderDrawer = page.getByTestId('mailbox-drawer')
    this.addFolderButton = page.getByTestId('add-new-folder-button')
    this.folderSearchButton = page.getByTestId('mailbox-search-button')
    this.emailList = page.getByTestId('email-list')
    this.emptyListView = page.getByTestId('empty-thread-view')
    this.composeButton = page.getByTestId('compose-email-button')
    this.userAvatar = page.getByTestId('user-avatar')
    this.scrollToTopButton = page.getByTestId('scroll-to-top-button')
    this.toast = page.getByTestId('toast')
    this.toastUndoButton = this.toast.getByTestId('toast-undo-button')
    this.shortcutsDialog = page.getByTestId('shortcuts-dialog')
  }

  /** True when the folders are in a drawer: phones and tablets */
  hasFolderDrawer(): boolean {
    const width = this.page.viewportSize()?.width ?? DESKTOP_MIN_WIDTH
    return width < DESKTOP_MIN_WIDTH
  }

  async expectLoaded(): Promise<MailboxPage> {
    if (this.hasFolderDrawer()) {
      await expect(this.folderMenuButton).toBeVisible()
      await expect(this.root).toBeVisible()
      return this
    }
    await expect(this.folderTree).toBeVisible()
    await expect(this.folder({ role: 'inbox' })).toBeVisible()
    return this
  }

  /** Makes the folder tree visible: opens the drawer when there is one */
  async showFolders(): Promise<MailboxPage> {
    if (this.hasFolderDrawer() && !(await this.folderDrawer.isVisible())) {
      await this.folderMenuButton.click()
      await expect(this.folderDrawer).toBeVisible()
    }
    await expect(this.folderTree).toBeVisible()
    return this
  }

  /** Closes the folder drawer (Escape), if open */
  async hideFolders(): Promise<MailboxPage> {
    if (await this.folderDrawer.isVisible()) {
      await this.page.keyboard.press('Escape')
      await expect(this.folderDrawer).toBeHidden()
    }
    return this
  }

  /** The folder is the selected one of the tree, looked at in the drawer if needed */
  async expectFolderSelected(ref: FolderRef): Promise<MailboxPage> {
    await this.showFolders()
    await expect(this.folder(ref)).toHaveAttribute('aria-current', 'page')
    return this.hideFolders()
  }

  /** The folder row: `mailbox-item` carrying `data-mailbox-role` / its name as text */
  folder(ref: FolderRef): Locator {
    const items = this.folderTree.getByTestId('mailbox-item')
    if ('role' in ref) {
      return items.and(this.page.locator(`[data-mailbox-role="${ref.role}"]`))
    }
    return items.filter({
      has: this.page
        .getByTestId('mailbox-item-name')
        .getByText(ref.name, { exact: true })
    })
  }

  /** Unread badge of a folder; absent when there is nothing unread */
  folderUnreadCount(ref: FolderRef): Locator {
    return this.folder(ref).getByTestId('mailbox-unread-count')
  }

  /** Opens a folder; the drawer, if any, closes once it is chosen */
  async openFolder(ref: FolderRef): Promise<MailboxPage> {
    await this.showFolders()
    const mailboxId = await this.folder(ref).getAttribute('data-mailbox-id')
    await this.folder(ref).click()
    if (this.hasFolderDrawer()) {
      await expect(this.folderDrawer).toBeHidden()
    } else {
      await expect(this.folder(ref)).toHaveAttribute('aria-current', 'page')
    }
    await expect(this.root).toHaveAttribute('data-mailbox-id', mailboxId ?? '')
    return this
  }

  /** Expand / collapse arrow of a folder that has children */
  async toggleFolder(ref: FolderRef): Promise<MailboxPage> {
    await this.showFolders()
    await this.folder(ref).getByTestId('mailbox-expand-button').click()
    return this
  }

  /** Folder actions menu (⋮ on hover, or right-click): New subfolder, Rename, Move, Delete, Empty trash... */
  async openFolderMenu(ref: FolderRef): Promise<Locator> {
    await this.showFolders()
    await this.folder(ref).hover()
    await this.folder(ref).getByTestId('mailbox-more-button').click()
    return this.page.getByTestId('mailbox-context-menu')
  }

  /** The list row of an email, by exact subject */
  emailRow(subject: string): Locator {
    return this.emailList.getByTestId('email-list-item').filter({
      has: this.page
        .getByTestId('email-list-item-subject')
        .getByText(subject, { exact: true })
    })
  }

  /** The link of a list row, which holds the focus of the row */
  emailRowLink(subject: string): Locator {
    return this.emailRow(subject).getByRole('link')
  }

  /** Star toggle of a list row (`aria-pressed` when starred) */
  emailRowStar(subject: string): Locator {
    return this.emailRow(subject).getByTestId('email-list-item-star')
  }

  async openEmail(subject: string): Promise<EmailPage> {
    await this.emailRow(subject).click()
    const email = new EmailPage(this.page)
    await email.expectSubject(subject)
    return email
  }

  async applyQuickFilter(filter: QuickFilter): Promise<MailboxPage> {
    await this.page.getByTestId(`quick-filter-${filter}`).click()
    return this
  }

  /**
   * Switches the "Thread" setting (conversations), from the account menu
   * until the settings screens exist
   */
  async setThreads(isEnabled: boolean): Promise<MailboxPage> {
    await this.userAvatar.click()
    const toggle = this.page.getByTestId('thread-setting-toggle')
    if ((await toggle.getAttribute('aria-checked')) !== String(isEnabled)) {
      await toggle.click()
    }
    await expect(toggle).toHaveAttribute('aria-checked', String(isEnabled))
    await this.page.keyboard.press('Escape')
    await expect(toggle).toBeHidden()
    return this
  }

  /** The number of messages a conversation row shows, absent for one email */
  emailRowThreadCount(subject: string): Locator {
    return this.emailRow(subject).getByTestId('email-list-item-thread-count')
  }

  async compose(): Promise<ComposerPage> {
    await this.composeButton.click()
    const composer = new ComposerPage(this.page)
    await expect(composer.root).toBeVisible()
    return composer
  }
}
