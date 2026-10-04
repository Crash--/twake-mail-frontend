import { expect, type Locator, type Page } from '@playwright/test'

import type { MailboxRole } from '../support/jmap'
import { ComposerPage } from './ComposerPage'
import { EmailPage } from './EmailPage'

/** A folder of the sidebar, by JMAP role (`inbox`, `trash`...) or by displayed name */
export type FolderRef = { role: MailboxRole } | { name: string }

export type QuickFilter = 'attachments' | 'unread' | 'starred'

/**
 * The mailbox screen: folder tree (sidebar) + email list (thread view).
 * Patrol counterparts: robots/mailbox_*_robot.dart, robots/thread_robot.dart.
 */
export class MailboxPage {
  readonly page: Page
  readonly folderTree: Locator
  readonly addFolderButton: Locator
  readonly folderSearchButton: Locator
  readonly emailList: Locator
  readonly emptyListView: Locator
  readonly composeButton: Locator
  readonly userAvatar: Locator
  readonly scrollToTopButton: Locator

  constructor(page: Page) {
    this.page = page
    this.folderTree = page.getByTestId('mailbox-tree')
    this.addFolderButton = page.getByTestId('add-new-folder-button')
    this.folderSearchButton = page.getByTestId('mailbox-search-button')
    this.emailList = page.getByTestId('email-list')
    this.emptyListView = page.getByTestId('empty-thread-view')
    this.composeButton = page.getByTestId('compose-email-button')
    this.userAvatar = page.getByTestId('user-avatar')
    this.scrollToTopButton = page.getByTestId('scroll-to-top-button')
  }

  async expectLoaded(): Promise<MailboxPage> {
    await expect(this.folderTree).toBeVisible()
    await expect(this.folder({ role: 'inbox' })).toBeVisible()
    return this
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

  async openFolder(ref: FolderRef): Promise<MailboxPage> {
    await this.folder(ref).click()
    await expect(this.folder(ref)).toHaveAttribute('aria-current', 'page')
    return this
  }

  /** Expand / collapse arrow of a folder that has children */
  async toggleFolder(ref: FolderRef): Promise<MailboxPage> {
    await this.folder(ref).getByTestId('mailbox-expand-button').click()
    return this
  }

  /** Folder actions menu (⋮ on hover, or right-click): New subfolder, Rename, Move, Delete, Empty trash... */
  async openFolderMenu(ref: FolderRef): Promise<Locator> {
    await this.folder(ref).hover()
    await this.folder(ref).getByTestId('mailbox-more-button').click()
    return this.page.getByTestId('mailbox-context-menu')
  }

  /** The list row of an email, by exact subject */
  emailRow(subject: string): Locator {
    return this.emailList
      .getByTestId('email-list-item')
      .filter({
        has: this.page
          .getByTestId('email-list-item-subject')
          .getByText(subject, { exact: true })
      })
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

  async compose(): Promise<ComposerPage> {
    await this.composeButton.click()
    const composer = new ComposerPage(this.page)
    await expect(composer.root).toBeVisible()
    return composer
  }
}
