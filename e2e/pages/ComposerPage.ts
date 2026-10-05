import { expect, type Locator, type Page } from '@playwright/test'

export type RecipientField = 'to' | 'cc' | 'bcc' | 'reply-to'

/**
 * The composer (new message, reply, forward, draft, template): a window of the dock at
 * the bottom of the screen on a desktop (the newest is the first of the page), the whole
 * screen on a phone.
 * Patrol counterparts: robots/composer_robot.dart, robots/web/web_composer_robot.dart.
 */
export class ComposerPage {
  readonly page: Page
  readonly root: Locator
  readonly toolbar: Locator
  readonly recipientsSummary: Locator
  readonly minimizeButton: Locator
  readonly fullscreenButton: Locator
  readonly identitySelect: Locator
  readonly saveStatus: Locator
  readonly sendError: Locator
  readonly deleteDraftButton: Locator
  readonly subjectInput: Locator
  readonly editor: Locator
  readonly sendButton: Locator
  readonly closeButton: Locator
  readonly moreButton: Locator
  readonly attachFileButton: Locator
  readonly insertImageButton: Locator
  readonly formattingButton: Locator
  readonly attachments: Locator

  constructor(
    page: Page,
    root: Locator = page.getByTestId('composer').first()
  ) {
    this.page = page
    this.root = root
    this.toolbar = this.root.getByRole('toolbar', {
      name: 'Formatting options'
    })
    this.recipientsSummary = this.root.getByTestId(
      'composer-recipients-summary'
    )
    this.minimizeButton = this.root.getByTestId('composer-minimize-button')
    this.fullscreenButton = this.root.getByTestId('composer-fullscreen-button')
    this.identitySelect = this.root.getByTestId('composer-identity-select')
    this.saveStatus = this.root.getByTestId('composer-save-status')
    this.sendError = this.root.getByTestId('composer-send-error')
    this.deleteDraftButton = this.root.getByTestId(
      'composer-delete-draft-button'
    )
    this.subjectInput = this.root.getByTestId('composer-subject-input')
    this.editor = this.root.getByTestId('composer-editor')
    this.sendButton = this.root.getByTestId('composer-send-button')
    this.closeButton = this.root.getByTestId('composer-close-button')
    this.moreButton = this.root.getByTestId('composer-more-button')
    this.attachFileButton = this.root.getByTestId('composer-attach-file-button')
    this.insertImageButton = this.root.getByTestId('rich-text-image-button')
    this.formattingButton = this.root.getByTestId('composer-formatting-button')
    this.attachments = this.root.getByTestId('composer-attachment-item')
  }

  /** A button of the formatting toolbar, by its name */
  toolbarButton(name: string): Locator {
    return this.toolbar.getByRole('button', { name, exact: true })
  }

  /** The HTML of the editing area, as the browser shows it */
  async editorHtml(): Promise<string> {
    return this.editor.innerHTML()
  }

  /** `normal`, `minimized` or `fullscreen` */
  async expectMode(
    mode: 'normal' | 'minimized' | 'fullscreen'
  ): Promise<ComposerPage> {
    await expect(this.root).toHaveAttribute('data-mode', mode)
    return this
  }

  /** Attaches a file through "Attach file", and waits for its upload */
  async attachFile(file: {
    name: string
    mimeType: string
    buffer: Buffer
  }): Promise<ComposerPage> {
    const count = await this.attachments.count()
    const chooser = this.page.waitForEvent('filechooser')
    await this.attachFileButton.click()
    await (await chooser).setFiles(file)
    await expect(this.attachments).toHaveCount(count + 1)
    await expect(this.attachments.nth(count)).toHaveAttribute(
      'data-status',
      'done',
      {
        timeout: 20_000
      }
    )
    return this
  }

  /** Inserts an image in the body through the footer button, at the caret */
  async insertImage(file: {
    name: string
    mimeType: string
    buffer: Buffer
  }): Promise<ComposerPage> {
    const images = this.editor.locator('img[data-reference]')
    const count = await images.count()
    const chooser = this.page.waitForEvent('filechooser')
    await this.insertImageButton.click()
    await (await chooser).setFiles(file)
    await expect(images).toHaveCount(count + 1, { timeout: 20_000 })
    return this
  }

  /**
   * Opens the From line (the "From" button of the To line) unless it is
   * open: a new message shows it on request, an answer or a draft with it
   */
  async showIdentity(): Promise<ComposerPage> {
    if (!(await this.identitySelect.isVisible())) {
      // Once the focus left the recipients they are folded, buttons included
      if (await this.recipientsSummary.isVisible()) {
        await this.recipientsSummary.click()
      }
      await this.root.getByTestId('composer-show-from-button').click()
    }
    await expect(this.identitySelect).toBeVisible()
    return this
  }

  /** Picks the identity to send from, by the start of its name */
  async chooseIdentity(name: string): Promise<ComposerPage> {
    await this.showIdentity()
    await this.identitySelect.click()
    await this.page
      .getByRole('option', { name: new RegExp(`^${name}`) })
      .click()
    await expect(this.identitySelect).toContainText(name)
    return this
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

  /** Closes a modified message, answering the "Save message" dialog */
  async closeAnd(choice: 'save' | 'discard' | 'cancel'): Promise<ComposerPage> {
    await this.closeButton.click()
    const dialog = this.page.getByTestId('confirm-dialog')
    await expect(dialog).toBeVisible()
    const button = {
      save: 'confirm-dialog-confirm-button',
      discard: 'confirm-dialog-alternative-button',
      cancel: 'confirm-dialog-cancel-button'
    }[choice]
    await dialog.getByTestId(button).click()
    await expect(dialog).toBeHidden()
    return this
  }
}
