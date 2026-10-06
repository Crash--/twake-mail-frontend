import { expect, type Locator, type Page } from '@playwright/test'

import { ComposerPage } from './ComposerPage'

/**
 * An email shown with its conversation (the "Thread" setting on): the
 * messages, collapsed or expanded, and the conversation actions.
 * Patrol counterparts: robots/thread_detail_robot.dart.
 */
export class ConversationPage {
  readonly page: Page
  readonly root: Locator
  readonly subject: Locator
  readonly count: Locator
  readonly messages: Locator
  readonly backButton: Locator
  /** The "More" button of the toolbar: the actions on the whole conversation */
  readonly toolbarMoreButton: Locator
  /** The labels of the whole conversation, under its subject */
  readonly labelChips: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('conversation-view')
    this.subject = this.root.getByTestId('conversation-subject')
    this.count = this.root.getByTestId('conversation-count')
    this.messages = this.root.getByTestId('conversation-message')
    this.backButton = this.root.getByTestId('email-view-back-button')
    this.toolbarMoreButton = this.root.getByTestId('conversation-more-button')
    this.labelChips = this.root
      .getByTestId('conversation-header')
      .getByTestId('label-chip')
  }

  async expectLoaded(subject: string): Promise<ConversationPage> {
    await expect(this.subject).toHaveText(subject)
    return this
  }

  /** Opens the menu of the toolbar (read, star, archive, trash, spam) */
  async openToolbarMenu(): Promise<Locator> {
    await this.toolbarMoreButton.click()
    const menu = this.page.getByTestId('conversation-menu')
    await expect(menu).toBeVisible()
    return menu
  }

  /** An action of the toolbar menu: `toggle-seen`, `toggle-star`, `archive`, `move-to-trash`, `mark-as-spam` */
  async runToolbarAction(action: string): Promise<void> {
    const menu = await this.openToolbarMenu()
    await menu.getByTestId(`conversation-${action}`).click()
    await expect(menu).toBeHidden()
  }

  /** A message, by a text of its header (sender, preview) */
  message(text: string | RegExp): Locator {
    return this.messages.filter({
      has: this.page.getByTestId('conversation-message-toggle').filter({
        hasText: text
      })
    })
  }

  /** The button expanding or collapsing a message (`aria-expanded`) */
  toggle(message: Locator): Locator {
    return message.getByTestId('conversation-message-toggle')
  }

  /**
   * The actions of an expanded message (the ids of the single email view:
   * `email-view-star-button`, `email-view-action-<action>`,
   * `email-view-more-button`), a group named by its sender and date
   */
  actions(message: Locator): Locator {
    return message.getByTestId('email-view-actions')
  }

  /** The button of an action of an expanded message (`email-view-action-<action>`) */
  actionButton(message: Locator, action: string): Locator {
    return this.actions(message).getByTestId(`email-view-action-${action}`)
  }

  starButton(message: Locator): Locator {
    return this.actions(message).getByTestId('email-view-star-button')
  }

  /** Opens the "More" menu of an expanded message */
  async openMore(message: Locator): Promise<Locator> {
    await this.actions(message).getByTestId('email-view-more-button').click()
    const menu = this.page.getByTestId('email-view-menu')
    await expect(menu).toBeVisible()
    return menu
  }

  /** The sender of an expanded message, a button opening its address menu */
  senderAddress(message: Locator): Locator {
    return message
      .getByTestId('conversation-message-sender')
      .getByTestId('email-address')
  }

  /** The label chips of an expanded message */
  messageLabelChips(message: Locator): Locator {
    return message.getByRole('region').getByTestId('label-chip')
  }

  /** The drafts of the conversation, marked "Draft" */
  drafts(): Locator {
    return this.messages.filter({
      has: this.page.getByTestId('conversation-message-draft')
    })
  }

  /** "Edit" of an expanded draft: the composer opens on it */
  async editDraft(message: Locator): Promise<ComposerPage> {
    await message.getByTestId('conversation-draft-edit-button').click()
    const composer = new ComposerPage(this.page)
    await expect(composer.root).toBeVisible()
    return composer
  }

  /** "Delete draft" of an expanded draft, confirmed */
  async deleteDraft(message: Locator): Promise<ConversationPage> {
    await message.getByTestId('conversation-draft-delete-button').click()
    const dialog = this.page.getByTestId('confirm-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('confirm-dialog-confirm-button').click()
    await expect(dialog).toBeHidden()
    return this
  }

  /** The sandboxed body of an expanded message */
  body(message: Locator): ReturnType<Locator['contentFrame']> {
    return message.getByTestId('email-view-body').contentFrame()
  }
}
