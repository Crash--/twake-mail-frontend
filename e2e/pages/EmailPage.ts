import { expect, type Locator, type Page } from '@playwright/test'

import { ComposerPage } from './ComposerPage'

export type EmailAction =
  | 'mark-as-read'
  | 'mark-as-unread'
  | 'star'
  | 'unstar'
  | 'move'
  | 'move-to-trash'
  | 'delete-permanently'
  | 'mark-as-spam'
  | 'not-spam'
  | 'archive'
  | 'label-as'
  | 'unsubscribe'
  | 'print'
  | 'download-eml'
  | 'edit-as-new'

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
  /** "Unsubscribe" link after the sender, and the note once unsubscribed */
  readonly unsubscribeLink: Locator
  readonly unsubscribedBanner: Locator
  /** The toolbar button of "Print all" */
  readonly printButton: Locator
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
    this.unsubscribeLink = this.root.getByTestId('email-unsubscribe-link')
    this.unsubscribedBanner = this.root.getByTestId('email-unsubscribed-banner')
    this.printButton = this.root.getByTestId('email-view-action-print')
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

  /** A link of the body, by its text */
  bodyLink(name: string): Locator {
    return this.body().getByRole('link', { name, exact: true })
  }

  /** Follows a `mailto:` link of the body with the keyboard: a new composer */
  async writeFromBodyLink(name: string): Promise<ComposerPage> {
    await this.bodyLink(name).focus()
    await this.bodyLink(name).press('Enter')
    return this.#composer()
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

  /** The "more" menu, open */
  async openMoreMenu(): Promise<Locator> {
    await this.moreButton.click()
    const menu = this.page.getByTestId('email-view-menu').getByRole('menu')
    await expect(menu).toBeVisible()
    return menu
  }

  /** Runs an action of the "more" menu (`email-action-<action>` items) */
  async runAction(action: EmailAction): Promise<EmailPage> {
    const menu = await this.openMoreMenu()
    await menu.getByTestId(`email-action-${action}`).click()
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
