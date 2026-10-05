import { expect, type Locator, type Page } from '@playwright/test'

import type { MailboxRole } from '../support/jmap'
import { ComposerPage } from './ComposerPage'
import { EmailPage } from './EmailPage'
import { SettingsPage } from './SettingsPage'

/** A folder of the sidebar, by JMAP role (`inbox`, `trash`...) or by displayed name */
export type FolderRef =
  | { role: MailboxRole }
  | { name: string }
  /** By JMAP id: the folders of a team mailbox share their names with the user's own */
  | { id: string }

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
  /** The composers the dock has no room for: "+N messages", then a menu */
  readonly composerOverflowButton: Locator
  readonly composerOverflowMenu: Locator
  readonly userAvatar: Locator
  readonly scrollToTopButton: Locator
  /** The toast at the bottom of the screen ("Moved to Trash", errors) */
  readonly toast: Locator
  readonly toastUndoButton: Locator
  /** The list of the keyboard shortcuts (`?`, account menu) */
  readonly shortcutsDialog: Locator
  /** Shown above the list while emails are selected */
  readonly selectionToolbar: Locator
  /** "Empty trash now" / "Delete all spam emails now" above the Trash / Spam list */
  readonly emptyTrashBanner: Locator
  readonly confirmDialog: Locator
  /** The folder picker ("Move To") */
  readonly mailboxPicker: Locator
  /** The dialog naming a folder, to create or rename it */
  readonly mailboxNameDialog: Locator
  readonly teamMailboxesSection: Locator
  readonly showHiddenFoldersButton: Locator

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
    this.composerOverflowButton = page.getByTestId('composer-overflow-button')
    this.composerOverflowMenu = page
      .getByTestId('composer-overflow-menu')
      .getByRole('menu')
    this.userAvatar = page.getByTestId('user-avatar')
    this.scrollToTopButton = page.getByTestId('scroll-to-top-button')
    this.toast = page.getByTestId('toast')
    this.toastUndoButton = this.toast.getByTestId('toast-undo-button')
    this.shortcutsDialog = page.getByTestId('shortcuts-dialog')
    this.selectionToolbar = page.getByTestId('selection-toolbar')
    this.emptyTrashBanner = page.getByTestId('empty-trash-banner')
    this.confirmDialog = page.getByTestId('confirm-dialog')
    this.mailboxPicker = page.getByTestId('mailbox-picker')
    this.mailboxNameDialog = page.getByTestId('mailbox-name-dialog')
    this.teamMailboxesSection = page.getByTestId('team-mailboxes-section')
    this.showHiddenFoldersButton = page.getByTestId(
      'show-hidden-folders-button'
    )
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
    // The folders of the user, and the team mailboxes in their own tree
    const items = this.page.getByTestId('mailbox-item')
    if ('role' in ref) {
      return items.and(this.page.locator(`[data-mailbox-role="${ref.role}"]`))
    }
    if ('id' in ref) {
      return items.and(this.page.locator(`[data-mailbox-id="${ref.id}"]`))
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
    // The link, not the row: the expand arrow sits inside the row
    await this.folder(ref).getByRole('link').click()
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
    const menu = this.page.getByTestId('mailbox-context-menu').getByRole('menu')
    await expect(menu).toBeVisible()
    return menu
  }

  /** Runs an action of a folder menu (`mailbox-action-<action>` items) */
  async runFolderAction(ref: FolderRef, action: string): Promise<MailboxPage> {
    const menu = await this.openFolderMenu(ref)
    await menu.getByTestId(`mailbox-action-${action}`).click()
    return this
  }

  /** Types a name in the open folder name dialog and submits it */
  async submitFolderName(name: string): Promise<MailboxPage> {
    await expect(this.mailboxNameDialog).toBeVisible()
    await this.mailboxNameDialog.getByTestId('mailbox-name-input').fill(name)
    await this.mailboxNameDialog
      .getByTestId('mailbox-name-submit-button')
      .click()
    await expect(this.mailboxNameDialog).toBeHidden()
    return this
  }

  /** The list row of an email, by exact subject */
  emailRow(subject: string): Locator {
    return this.emailList.getByTestId('email-list-item').filter({
      has: this.page
        .getByTestId('email-list-item-subject')
        .getByText(subject, { exact: true })
    })
  }

  /**
   * Scrolls the list (virtualized: rows below are not rendered) until the
   * row of an email shows
   */
  async scrollToEmail(subject: string): Promise<Locator> {
    const row = this.emailRow(subject)
    await this.emailList.hover()
    await expect(async () => {
      // Rendered rows (overscan) can scroll into view, the others come by
      // scrolling the list
      if (await row.isVisible()) await row.scrollIntoViewIfNeeded()
      else await this.page.mouse.wheel(0, 600)
      await expect(row).toBeInViewport({ timeout: 500 })
    }).toPass()
    return row
  }

  /** The link of a list row, which holds the focus of the row */
  emailRowLink(subject: string): Locator {
    return this.emailRow(subject).getByRole('link')
  }

  /** Selection checkbox of a list row: its root, over which the input lies */
  emailRowCheckbox(subject: string): Locator {
    return this.emailRow(subject).getByTestId('email-list-item-checkbox')
  }

  /** Checks a row; with `range`, every row from the last one checked (Shift) */
  async selectEmail(
    subject: string,
    { range = false }: { range?: boolean } = {}
  ): Promise<MailboxPage> {
    await this.emailRowCheckbox(subject).click(
      range ? { modifiers: ['Shift'] } : {}
    )
    await expect(this.selectionToolbar).toBeVisible()
    return this
  }

  /** A button of the selection toolbar (`selected-email-action-<action>`) */
  selectionAction(action: string): Locator {
    return this.selectionToolbar.getByTestId(`selected-email-action-${action}`)
  }

  /** Runs an action of the selection toolbar, from its "More" menu when not a button */
  async runSelectionAction(action: string): Promise<MailboxPage> {
    const button = this.selectionAction(action)
    if (await button.isVisible()) {
      await button.click()
    } else {
      await this.selectionAction('more').click()
      await this.page
        .getByTestId('selection-toolbar-menu')
        .getByTestId(`email-action-${action}`)
        .click()
    }
    return this
  }

  /** The actions menu of a row: from its ⋮ button, or a right click */
  async openEmailMenu(
    subject: string,
    { rightClick = false }: { rightClick?: boolean } = {}
  ): Promise<Locator> {
    if (rightClick) {
      await this.emailRow(subject).click({ button: 'right' })
    } else {
      await this.emailRow(subject).hover()
      await this.emailRow(subject).getByTestId('email-list-item-more').click()
    }
    const menu = this.page.getByTestId('email-context-menu').getByRole('menu')
    await expect(menu).toBeVisible()
    return menu
  }

  /** Picks a folder in the open picker, after typing its name in the filter */
  async pickFolder(name: string): Promise<MailboxPage> {
    await expect(this.mailboxPicker).toBeVisible()
    await this.mailboxPicker
      .getByTestId('mailbox-picker-search-input')
      .fill(name)
    await this.mailboxPicker
      .getByRole('option', { name: new RegExp(`^${name}`) })
      .first()
      .click()
    await expect(this.mailboxPicker).toBeHidden()
    return this
  }

  /** The subjects of the rows, in their order */
  async emailSubjects(): Promise<string[]> {
    return this.emailList.getByTestId('email-list-item-subject').allInnerTexts()
  }

  /** The sender of a row, or the participants of a conversation */
  emailRowSender(subject: string): Locator {
    return this.emailRow(subject).getByTestId('email-list-item-sender')
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

  /** Opens the settings from the account menu */
  async openSettings(): Promise<SettingsPage> {
    await this.userAvatar.click()
    await this.page.getByTestId('settings-menu-item').click()
    const settings = new SettingsPage(this.page)
    await expect(settings.heading).toBeVisible()
    return settings
  }

  /** Switches the "Thread" setting (conversations) in Settings > Preferences, then back to mail */
  async setThreads(isEnabled: boolean): Promise<MailboxPage> {
    const settings = await this.openSettings()
    await settings.open('preferences')
    const toggle = this.page.getByTestId('thread-setting-toggle').getByRole('switch')
    await toggle.setChecked(isEnabled)
    await expect(toggle).toBeChecked({ checked: isEnabled })
    await settings.backToMail()
    await expect(this.root).toBeVisible()
    return this
  }

  /** The number of messages a conversation row shows, absent for one email */
  emailRowThreadCount(subject: string): Locator {
    return this.emailRow(subject).getByTestId('email-list-item-thread-count')
  }

  /** The "important" mark of a row (set by its sender) */
  emailRowImportantIcon(subject: string): Locator {
    return this.emailRow(subject).getByTestId('important-flag-icon')
  }

  /** Brings back a composer left out of the dock, with the keyboard */
  async showComposerFromOverflow(subject: string): Promise<ComposerPage> {
    await this.composerOverflowButton.focus()
    await this.page.keyboard.press('Enter')
    await expect(this.composerOverflowMenu).toBeVisible()
    const item = this.composerOverflowMenu.getByRole('menuitem', { name: subject })
    while (!(await item.evaluate(element => element === document.activeElement))) {
      await this.page.keyboard.press('ArrowDown')
    }
    await this.page.keyboard.press('Enter')
    const composer = new ComposerPage(
      this.page,
      this.page.getByRole('dialog', { name: subject })
    )
    await expect(composer.root).toBeVisible()
    return composer
  }

  async compose(): Promise<ComposerPage> {
    await this.composeButton.click()
    const composer = new ComposerPage(this.page)
    await expect(composer.root).toBeVisible()
    return composer
  }
}
