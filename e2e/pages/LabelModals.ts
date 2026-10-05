import { expect, type Locator, type Page } from '@playwright/test'

/**
 * The labels: their section of the sidebar, the label modal (create,
 * edit) and the "Label as" modal.
 * Patrol counterparts: robots/labels/*_robot.dart.
 */
export class LabelModals {
  readonly page: Page
  readonly section: Locator
  readonly addButton: Locator
  readonly labelModal: Locator
  readonly nameInput: Locator
  readonly descriptionInput: Locator
  readonly saveButton: Locator
  readonly chooseModal: Locator
  readonly chooseEmpty: Locator
  readonly chooseCreateButton: Locator
  readonly chooseApplyButton: Locator

  constructor(page: Page) {
    this.page = page
    this.section = page.getByTestId('labels-section')
    this.addButton = page.getByTestId('add-new-label-button')
    this.labelModal = page.getByTestId('label-modal')
    this.nameInput = this.labelModal.getByTestId('label-name-input')
    this.descriptionInput = this.labelModal.getByTestId('label-description-input')
    this.saveButton = this.labelModal.getByTestId('label-save-button')
    this.chooseModal = page.getByTestId('choose-label-modal')
    this.chooseEmpty = this.chooseModal.getByTestId('choose-label-empty')
    this.chooseCreateButton = this.chooseModal.getByTestId('choose-label-create-button')
    this.chooseApplyButton = this.chooseModal.getByTestId('choose-label-apply-button')
  }

  /** A label of the sidebar, by name */
  item(name: string): Locator {
    return this.section.getByTestId('label-item').filter({
      has: this.page.getByRole('link', { name, exact: true })
    })
  }

  async open(name: string): Promise<void> {
    await this.item(name).getByRole('link', { name, exact: true }).click()
    await expect(this.page.getByTestId('label-page')).toBeVisible()
  }

  /** Runs Edit or Delete from the ⋮ menu of a label */
  async runMenu(name: string, action: 'edit' | 'delete'): Promise<void> {
    // The button shows on hover, or on focus
    await this.item(name).hover()
    await this.item(name).getByTestId('label-item-menu-button').click()
    await this.page.getByTestId(`label-${action}-item`).click()
  }

  /** Fills the label modal and saves it */
  async fillAndSave(name: string, description?: string): Promise<void> {
    await expect(this.labelModal).toBeVisible()
    await this.nameInput.fill(name)
    if (description !== undefined) await this.descriptionInput.fill(description)
    await this.saveButton.click()
    await expect(this.labelModal).toBeHidden()
  }

  /** A label of the "Label as" modal: its checkbox */
  chooseCheckbox(name: string): Locator {
    return this.chooseModal
      .getByTestId('choose-label-item')
      .filter({ hasText: name })
      .getByRole('checkbox')
  }
}
