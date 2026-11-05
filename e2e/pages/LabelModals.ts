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
  readonly colorPicker: Locator
  readonly colorOptions: Locator
  readonly customColorOption: Locator
  readonly noColorOption: Locator
  readonly customColorHexInput: Locator
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
    // The icon button beside the name; it opens the colours in a popover
    this.colorPicker = this.labelModal.getByTestId('label-color-picker')
    this.colorOptions = page.getByTestId('label-color-picker-popover')
    this.customColorOption = this.colorOptions.getByRole('radio', {
      name: 'Custom color (hexadecimal)'
    })
    this.noColorOption = this.colorOptions.getByRole('radio', {
      name: 'No color'
    })
    this.customColorHexInput = this.labelModal.getByTestId(
      'label-color-hex-input'
    )
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
    const more = this.item(name).getByTestId('label-item-menu-button')
    // count() does not wait: the row must be there first
    await expect(this.item(name)).toBeVisible()
    if ((await more.count()) > 0) {
      // The button shows on hover, or on focus
      await this.item(name).hover()
      await more.click()
    } else {
      // A phone has no ⋮: a long press, or the keyboard as here
      await this.item(name).getByRole('link', { name, exact: true }).focus()
      await this.page.keyboard.press('Shift+F10')
    }
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

  colorOption(name: string): Locator {
    return this.colorOptions.getByRole('radio', { name, exact: true })
  }

  async openColors(): Promise<void> {
    await this.colorPicker.click()
    await expect(this.colorOptions).toBeVisible()
  }

  /** Picks the custom colour by its hexadecimal field */
  async chooseCustomColor(hex: string): Promise<void> {
    await this.openColors()
    await this.customColorOption.click()
    await this.customColorHexInput.fill(hex)
  }

  /** A label of the "Label as" modal: its checkbox */
  chooseCheckbox(name: string): Locator {
    return this.chooseModal
      .getByTestId('choose-label-item')
      .filter({ hasText: name })
      .getByRole('checkbox')
  }
}
