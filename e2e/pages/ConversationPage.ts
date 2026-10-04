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

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('conversation-view')
    this.subject = this.root.getByTestId('conversation-subject')
    this.count = this.root.getByTestId('conversation-count')
    this.messages = this.root.getByTestId('conversation-message')
    this.backButton = this.root.getByTestId('email-view-back-button')
    this.toggleSeenButton = this.root.getByTestId('conversation-toggle-seen')
    this.toggleStarButton = this.root.getByTestId('conversation-toggle-star')
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

  /** The sandboxed body of an expanded message */
  body(message: Locator): ReturnType<Locator['contentFrame']> {
    return message.getByTestId('email-view-body').contentFrame()
  }
}
