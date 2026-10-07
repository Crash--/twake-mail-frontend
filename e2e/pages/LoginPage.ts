import { expect, type Locator, type Page } from '@playwright/test'

import { MailboxPage } from './MailboxPage'

/** Credentials of a test account (support/users.ts E2EUser fits) */
export interface Credentials {
  email: string
  password: string
}

/**
 * Login screen. Phase 0: basic auth (username + password against tmail-backend).
 * Patrol counterpart: robots/login_robot.dart, robots/web/web_login_robot.dart.
 */
export class LoginPage {
  readonly page: Page
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  /** OIDC (phase 1): "Sign in with SSO" */
  readonly ssoButton: Locator

  constructor(page: Page) {
    this.page = page
    this.usernameInput = page.getByTestId('login-username-input')
    this.passwordInput = page.getByTestId('login-password-input')
    this.submitButton = page.getByTestId('login-submit-button')
    this.errorMessage = page.getByTestId('login-error')
    this.ssoButton = page.getByTestId('login-sso-button')
  }

  async goto(): Promise<LoginPage> {
    await this.page.goto('/')
    await expect(this.usernameInput).toBeVisible()
    return this
  }

  /**
   * After a reload: waits for the form the app redirects to, then signs in.
   * `loginAs` would go to `/login` itself when the form is not there yet,
   * and the app would forget the page the user was on.
   */
  async loginAfterReload(credentials: Credentials): Promise<MailboxPage> {
    await expect(this.usernameInput).toBeVisible()
    return this.loginAs(credentials)
  }

  /**
   * Fills the form and waits for the mailbox: `await new LoginPage(page).loginAs(user)`.
   * A tab opened next to a signed-in one gets its session without the form.
   */
  async loginAs(credentials: Credentials): Promise<MailboxPage> {
    const mailbox = new MailboxPage(this.page)
    if (!(await this.usernameInput.isVisible())) {
      await this.page.goto('/')
      await expect(this.usernameInput.or(mailbox.root)).toBeVisible()
    }
    if (await this.usernameInput.isVisible()) {
      await this.usernameInput.fill(credentials.email)
      await this.passwordInput.fill(credentials.password)
      await this.submitButton.click()
    }
    await mailbox.expectLoaded()
    return mailbox
  }
}
