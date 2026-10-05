import { expect, type Locator, type Page } from '@playwright/test'

/** The settings sections, by the alias of their URL (tmail-flutter `getAliasBrowser`) */
export type SettingsSectionId =
  | 'profiles'
  | 'email-rules'
  | 'preferences'
  | 'forwarding'
  | 'vacation'
  | 'folder-visibility'
  | 'language-region'
  | 'keyboard-shortcuts'
  | 'storage'

/** Below this width the sections are listed in the page (app `SCREEN_BREAKPOINTS.desktop`) */
const DESKTOP_MIN_WIDTH = 1200

/**
 * The settings (`/settings`): on a desktop the sections in the sidebar and
 * the one opened beside; on smaller screens their list, then one in its
 * place with a back button.
 * Patrol counterparts: robots/setting_robot.dart, profiles_robot.dart,
 * identity_creator_robot.dart, preferences_robot.dart.
 */
export class SettingsPage {
  readonly page: Page
  readonly backToMailButton: Locator
  readonly sectionBackButton: Locator
  readonly heading: Locator
  readonly toast: Locator
  readonly confirmDialog: Locator
  // Profiles
  readonly createIdentityButton: Locator
  readonly identityItems: Locator
  readonly identityDialog: Locator
  // Email rules
  readonly addRuleButton: Locator
  readonly ruleItems: Locator
  readonly ruleDialog: Locator
  // Forwarding
  readonly forwardInput: Locator
  readonly forwardItems: Locator

  constructor(page: Page) {
    this.page = page
    this.backToMailButton = page.getByTestId('settings-back-button')
    this.sectionBackButton = page.getByTestId('settings-section-back-button')
    this.heading = page.getByRole('heading', { level: 1 })
    this.toast = page.getByTestId('toast')
    this.confirmDialog = page.getByTestId('confirm-dialog')
    this.createIdentityButton = page.getByTestId('create-new-identity-button')
    this.identityItems = page.getByTestId('identity-item')
    this.identityDialog = page.getByTestId('identity-form-dialog')
    this.addRuleButton = page.getByTestId('add-rule-button')
    this.ruleItems = page.getByTestId('email-rule-item')
    this.ruleDialog = page.getByTestId('rule-form-dialog')
    this.forwardInput = page.getByTestId('forward-input')
    this.forwardItems = page.getByTestId('forward-item')
  }

  async #isDesktop(): Promise<boolean> {
    const width = this.page.viewportSize()?.width ?? DESKTOP_MIN_WIDTH
    return width >= DESKTOP_MIN_WIDTH
  }

  section(id: SettingsSectionId): Locator {
    return this.page.getByTestId(`settings-section-${id}`)
  }

  menuItem(id: SettingsSectionId): Locator {
    return this.page.getByTestId(`settings-menu-${id}`)
  }

  /** Opens a section from the sidebar, or from the list below the desktop size */
  async open(id: SettingsSectionId): Promise<SettingsPage> {
    if (!(await this.#isDesktop()) && !(await this.menuItem(id).isVisible())) {
      await this.sectionBackButton.click()
    }
    await this.menuItem(id).click()
    await expect(this.section(id)).toBeVisible()
    return this
  }

  rule(name: string): Locator {
    return this.ruleItems.filter({
      has: this.page.getByTestId('email-rule-name').getByText(name, { exact: true })
    })
  }

  /** Picks the action of a row of the rule creator (1-based) */
  async selectRuleAction(position: number, label: string): Promise<void> {
    await this.ruleDialog
      .getByRole('group', { name: `Action ${position}` })
      .getByTestId('rule-action-select')
      .selectOption({ label })
  }

  /** Back to the mail, from a section on any screen size */
  async backToMail(): Promise<void> {
    if (!(await this.#isDesktop()) && (await this.sectionBackButton.isVisible())) {
      await this.sectionBackButton.click()
    }
    await this.backToMailButton.click()
  }

  identity(name: string): Locator {
    return this.identityItems.filter({
      has: this.page.getByTestId('identity-item-name').getByText(name, { exact: true })
    })
  }

  /** Creates an identity through the dialog, with only a name unless told more */
  async createIdentity(input: {
    name: string
    bcc?: string
    replyTo?: string
    signature?: string
    isDefault?: boolean
  }): Promise<void> {
    await this.createIdentityButton.click()
    await expect(this.identityDialog).toBeVisible()
    await this.identityDialog.getByTestId('identity-name-input').fill(input.name)
    if (input.replyTo !== undefined) {
      await this.identityDialog.getByTestId('identity-reply-to-input').fill(input.replyTo)
    }
    if (input.bcc !== undefined) {
      await this.identityDialog.getByTestId('identity-bcc-input').fill(input.bcc)
    }
    if (input.signature !== undefined) {
      await this.identityDialog.getByTestId('identity-signature-editor').click()
      await this.page.keyboard.type(input.signature)
    }
    if (input.isDefault === true) {
      await this.identityDialog
        .getByTestId('identity-default-checkbox')
        .getByRole('checkbox')
        .check()
    }
    await this.identityDialog.getByTestId('save-identity-button').click()
    await expect(this.identityDialog).toBeHidden()
    await expect(this.identity(input.name)).toBeVisible()
  }

  /** Picks the identity as the default one with its radio (`select_identity_as_default`) */
  async setDefaultIdentity(name: string): Promise<void> {
    await this.identity(name).getByTestId('identity-default-radio').getByRole('radio').check()
  }

  defaultRadio(name: string): Locator {
    return this.identity(name).getByTestId('identity-default-radio').getByRole('radio')
  }
}
