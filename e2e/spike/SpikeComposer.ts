import { expect, type Locator, type Page } from '@playwright/test'

import type { Credentials } from '../pages/LoginPage'

/** The /spike/composer page (DEBUG route of the composer spike) */
export class SpikeComposer {
  readonly page: Page
  readonly editor: Locator
  readonly toolbar: Locator
  readonly to: Locator
  readonly subject: Locator
  readonly status: Locator
  readonly sendButton: Locator

  constructor(page: Page) {
    this.page = page
    this.editor = page.getByRole('textbox', { name: 'Message body' })
    this.toolbar = page.getByRole('toolbar', { name: 'Formatting options' })
    this.to = page.getByTestId('composer-to-input')
    this.subject = page.getByTestId('composer-subject-input')
    this.status = page.getByTestId('spike-status')
    this.sendButton = page.getByTestId('composer-send-button')
  }

  /** Signs in (the login page brings back to the requested path) and opens the composer */
  async open(user: Credentials, query = ''): Promise<SpikeComposer> {
    await this.page.goto(`/spike/composer${query}`)
    await this.page.getByTestId('login-username-input').fill(user.email)
    await this.page.getByTestId('login-password-input').fill(user.password)
    await this.page.getByTestId('login-submit-button').click()
    await expect(this.editor).toBeVisible({ timeout: 20_000 })
    return this
  }

  button(name: string): Locator {
    return this.toolbar.getByRole('button', { name, exact: true })
  }

  /** The editor HTML (`editor.getHTML()`) */
  async editorHtml(): Promise<string> {
    return this.page.evaluate(() => {
      const editor = (window as unknown as { spikeEditor: { getHTML: () => string } })
        .spikeEditor
      return editor.getHTML()
    })
  }

  async send(): Promise<void> {
    await this.sendButton.click()
    await expect(this.status).toHaveText('Message sent', { timeout: 20_000 })
  }

  async shot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `/tmp/twake-mail-shots/spike-composer-${name}.png`,
      fullPage: true
    })
  }
}
