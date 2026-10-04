import { expect, type Locator, type Page } from '@playwright/test'

import { ComposerPage } from './ComposerPage'

export type EmailAction =
  | 'mark-as-unread'
  | 'star'
  | 'unstar'
  | 'move'
  | 'move-to-trash'
  | 'mark-as-spam'
  | 'archive'
  | 'label-as'

/**
 * An opened email (reading pane / full screen).
 * Patrol counterparts: robots/email_robot.dart, robots/thread_robot.dart (open/back).
 */
export class EmailPage {
  readonly page: Page
  readonly root: Locator
  readonly subject: Locator
  readonly from: Locator
  readonly to: Locator
  readonly cc: Locator
  readonly receivedAt: Locator
  readonly attachments: Locator
  readonly backButton: Locator
  readonly replyButton: Locator
  readonly replyAllButton: Locator
  readonly replyToListButton: Locator
  readonly forwardButton: Locator
  readonly moreButton: Locator
  /** "Remote images hidden" banner, and its buttons */
  readonly remoteContentBanner: Locator
  readonly showRemoteContentButton: Locator
  readonly alwaysShowRemoteContentButton: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('email-view')
    this.subject = this.root.getByTestId('email-view-subject')
    this.from = this.root.getByTestId('email-view-from')
    this.to = this.root.getByTestId('email-view-to')
    this.cc = this.root.getByTestId('email-view-cc')
    this.receivedAt = this.root.getByTestId('email-view-date')
    this.attachments = this.root.getByTestId('attachment-item')
    this.backButton = this.root.getByTestId('email-view-back-button')
    this.replyButton = this.root.getByTestId('reply-email-button')
    this.replyAllButton = this.root.getByTestId('reply-all-emails-button')
    this.replyToListButton = this.root.getByTestId('reply-to-list-email-button')
    this.forwardButton = this.root.getByTestId('forward-email-button')
    this.moreButton = this.root.getByTestId('email-view-more-button')
    this.remoteContentBanner = this.root.getByTestId('remote-content-banner')
    this.showRemoteContentButton = this.root.getByTestId(
      'remote-content-show-button'
    )
    this.alwaysShowRemoteContentButton = this.root.getByTestId(
      'remote-content-always-show-button'
    )
  }

  async expectSubject(subject: string): Promise<EmailPage> {
    await expect(this.subject).toHaveText(subject)
    return this
  }

  /**
   * The rendered message body. Assumes the HTML is isolated in a sandboxed iframe carrying
   * `email-view-body` (XSS, EML-07); if the app renders it inline, drop `.contentFrame()`.
   */
  body(): Locator {
    return this.root
      .getByTestId('email-view-body')
      .contentFrame()
      .locator('body')
  }

  async reply(): Promise<ComposerPage> {
    await this.replyButton.click()
    return this.#composer()
  }

  async replyAll(): Promise<ComposerPage> {
    await this.replyAllButton.click()
    return this.#composer()
  }

  async forward(): Promise<ComposerPage> {
    await this.forwardButton.click()
    return this.#composer()
  }

  /** Runs an action of the "more" menu (`email-action-<action>` items) */
  async runAction(action: EmailAction): Promise<EmailPage> {
    await this.moreButton.click()
    await this.page.getByTestId(`email-action-${action}`).click()
    return this
  }

  async back(): Promise<EmailPage> {
    await this.backButton.click()
    await expect(this.root).toBeHidden()
    return this
  }

  async #composer(): Promise<ComposerPage> {
    const composer = new ComposerPage(this.page)
    await expect(composer.root).toBeVisible()
    return composer
  }
}
