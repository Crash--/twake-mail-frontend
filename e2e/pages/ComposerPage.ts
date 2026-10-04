import { expect, type Locator, type Page } from '@playwright/test'

export type RecipientField = 'to' | 'cc' | 'bcc' | 'reply-to'

/**
 * The composer (new message, reply, forward, draft, template).
 * Patrol counterparts: robots/composer_robot.dart, robots/web/web_composer_robot.dart.
 */
export class ComposerPage {
  readonly page: Page
  readonly root: Locator
  readonly subjectInput: Locator
  readonly editor: Locator
  readonly sendButton: Locator
  readonly closeButton: Locator
  readonly moreButton: Locator
  readonly attachFileButton: Locator
  readonly attachments: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('composer')
    this.subjectInput = this.root.getByTestId('composer-subject-input')
    this.editor = this.root.getByTestId('composer-editor')
    this.sendButton = this.root.getByTestId('composer-send-button')
    this.closeButton = this.root.getByTestId('composer-close-button')
    this.moreButton = this.root.getByTestId('composer-more-button')
    this.attachFileButton = this.root.getByTestId('composer-attach-file-button')
    this.attachments = this.root.getByTestId('composer-attachment-item')
  }

  recipientInput(field: RecipientField): Locator {
    return this.root.getByTestId(`composer-${field}-input`)
  }

  /** Recipient chips already in a field */
  recipients(field: RecipientField): Locator {
    return this.root
      .getByTestId(`composer-${field}-field`)
      .getByTestId('recipient-chip')
  }

  /** Cc / Bcc / Reply-To are collapsed by default */
  async showField(field: Exclude<RecipientField, 'to'>): Promise<ComposerPage> {
    await this.root.getByTestId(`composer-show-${field}-button`).click()
    return this
  }

  async addRecipient(
    field: RecipientField,
    email: string
  ): Promise<ComposerPage> {
    await this.recipientInput(field).fill(email)
    await this.recipientInput(field).press('Enter')
    await expect(
      this.recipients(field).filter({ hasText: email })
    ).toBeVisible()
    return this
  }

  async fill(input: {
    to?: string[]
    subject?: string
    body?: string
  }): Promise<ComposerPage> {
    for (const email of input.to ?? []) {
      await this.addRecipient('to', email)
    }
    if (input.subject !== undefined) {
      await this.subjectInput.fill(input.subject)
    }
    if (input.body !== undefined) {
      await this.editor.click()
      await this.page.keyboard.type(input.body)
    }
    return this
  }

  async send(): Promise<ComposerPage> {
    await this.sendButton.click()
    await expect(this.root).toBeHidden()
    return this
  }

  /** More menu items: `composer-save-draft-item`, `composer-save-template-item`, `composer-read-receipt-item`, `composer-mark-important-item` */
  async runMoreAction(
    item: 'save-draft' | 'save-template' | 'read-receipt' | 'mark-important'
  ): Promise<ComposerPage> {
    await this.moreButton.click()
    await this.page.getByTestId(`composer-${item}-item`).click()
    return this
  }

  async close(): Promise<ComposerPage> {
    await this.closeButton.click()
    return this
  }
}
