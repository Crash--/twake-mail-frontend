import { expect, type Locator, type Page } from '@playwright/test'

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
  readonly toggleSeenButton: Locator
  readonly toggleStarButton: Locator
  /** The labels of the whole conversation, under its subject */
  readonly labelChips: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('conversation-view')
    this.subject = this.root.getByTestId('conversation-subject')
    this.count = this.root.getByTestId('conversation-count')
    this.messages = this.root.getByTestId('conversation-message')
    this.backButton = this.root.getByTestId('email-view-back-button')
    this.toggleSeenButton = this.root.getByTestId('conversation-toggle-seen')
    this.toggleStarButton = this.root.getByTestId('conversation-toggle-star')
    this.labelChips = this.root
      .getByTestId('conversation-header')
      .getByTestId('label-chip')
  }

  async expectLoaded(subject: string): Promise<ConversationPage> {
    await expect(this.subject).toHaveText(subject)
    return this
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

  /** The sandboxed body of an expanded message */
  body(message: Locator): ReturnType<Locator['contentFrame']> {
    return message.getByTestId('email-view-body').contentFrame()
  }
}
