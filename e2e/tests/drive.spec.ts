import type { Page } from '@playwright/test'

import { ComposerPage, MailboxPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'

/**
 * The Twake Drive picker of the composer (`TDRIVE_ENABLED`), against the fake
 * Drive of the stack (docker/drive-picker.html and docker/nginx/default.conf:
 * token exchange, intent, a picker speaking the cozy-interapp protocol, a
 * file to download). The picker trades the ID token of the session: the app
 * must run in OIDC mode (Dex), with docker/app-env-oidc.js.
 *
 *   E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh
 *   npx playwright test tests/drive.spec.ts
 *
 * The account is Dex's static alice: each spec deletes the draft it made.
 */

async function appRunsInOidcMode(): Promise<boolean> {
  try {
    const config = await (await fetch(`${env.baseUrl}/.env.js`)).text()
    return /AUTH_MODE\s*=\s*'oidc'/.test(config) && /TDRIVE_ENABLED\s*=\s*true/.test(config)
  } catch {
    return false
  }
}

async function signInWithDex(page: Page): Promise<MailboxPage> {
  await page.goto('/')
  await page.waitForURL(url => url.pathname.startsWith('/dex/'))
  await page.getByRole('textbox', { name: /email/i }).fill('alice@example.com')
  await page.getByRole('textbox', { name: /password/i }).fill('secret')
  await page.getByRole('button', { name: /login/i }).click()
  const grant = page.getByRole('button', { name: /grant access/i })
  if (await grant.isVisible().catch(() => false)) await grant.click()
  const mailbox = new MailboxPage(page)
  await mailbox.expectLoaded()
  return mailbox
}

async function openDrivePicker(
  page: Page,
  mailbox: MailboxPage
): Promise<ComposerPage> {
  const composer = await mailbox.compose()
  await composer.root.getByTestId('composer-drive-button').click()
  const dialog = page.getByRole('dialog', { name: 'Twake Drive' })
  await expect(dialog).toBeVisible()
  const picker = page.frameLocator('[data-testid="drive-picker-frame"]')
  await expect(picker.getByRole('button', { name: 'Add as link' })).toBeEnabled()
  return composer
}

async function deleteDraft(composer: ComposerPage): Promise<void> {
  await composer.deleteDraftButton.click()
  await expect(composer.root).toBeHidden()
}

test.describe('DRIVE Twake Drive picker', () => {
  test.beforeAll(async () => {
    test.skip(
      !(await appRunsInOidcMode()),
      'needs the app in OIDC mode with the fake Drive: E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh'
    )
  })

  test('DRIVE-01 "Attach from Drive" opens the picker in a named dialog (full screen on phones); "Add as link" inserts a Drive card, the focus back in the message', { tag: '@mobile' }, async ({
    page
  }) => {
    const mailbox = await signInWithDex(page)
    const composer = await openDrivePicker(page, mailbox)
    await expectNoA11yViolations(page)

    await page
      .frameLocator('[data-testid="drive-picker-frame"]')
      .getByRole('button', { name: 'Add as link' })
      .click()

    await expect(page.getByRole('dialog', { name: 'Twake Drive' })).toBeHidden()
    const card = composer.editor.locator('a.tmail-file-link-card')
    await expect(card).toHaveAttribute(
      'href',
      `http://localhost:${new URL(env.baseUrl).port}/e2e/drive/share/report`
    )
    await expect(card).toContainText('report.txt')
    // Back in the message, after the card
    await expect(composer.editor).toBeFocused()
    await deleteDraft(composer)
  })

  test('DRIVE-02 "Add as attachment" downloads the file and attaches it', async ({
    page
  }) => {
    const mailbox = await signInWithDex(page)
    const composer = await openDrivePicker(page, mailbox)

    await page
      .frameLocator('[data-testid="drive-picker-frame"]')
      .getByRole('button', { name: 'Add as attachment' })
      .click()

    await expect(composer.attachments).toHaveCount(1)
    await expect(composer.attachments.first()).toContainText('report.txt')
    await expect(composer.attachments.first()).toHaveAttribute('data-status', 'done')
    await deleteDraft(composer)
  })

  test('DRIVE-03 Cancel in the picker closes it, the message unchanged', async ({
    page
  }) => {
    const mailbox = await signInWithDex(page)
    const composer = await openDrivePicker(page, mailbox)

    await page
      .frameLocator('[data-testid="drive-picker-frame"]')
      .getByRole('button', { name: 'Cancel' })
      .click()

    await expect(page.getByRole('dialog', { name: 'Twake Drive' })).toBeHidden()
    await expect(composer.editor.locator('a.tmail-file-link-card')).toHaveCount(0)
    await expect(composer.attachments).toHaveCount(0)
    await composer.close()
  })
})
