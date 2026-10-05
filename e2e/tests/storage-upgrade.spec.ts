import type { BrowserContext, FrameLocator, Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import { WebAdminClient } from '../support/webadmin'

/**
 * The storage upgrade of the Twake platform (tmail-flutter `premiumCtaProvider`): a way to
 * the paywall in the quota banner, the sidebar footer, Settings > Storage and the composer
 * error, only with the SaaS capability (`com:linagora:params:saas`), inside Twake Workplace
 * (`WORKPLACE_EMBEDDING` in an iframe) and with a safe https paywall URL (here the Workplace
 * of the user, `WORKPLACE_FQDN_FALLBACK` of docker/app-env.js).
 *
 * The backend has no SaaS capability: the session is answered with one by the spec.
 */

const SAAS = 'com:linagora:params:saas'
const WORKPLACE = `http://localhost:${new URL(env.baseUrl).port}/e2e/workplace.html`
const PAYWALL_HOSTS = /^https:\/\/[^/]*workplace\.example\.test\//

type Saas = { isPaying?: boolean; canUpgrade?: boolean } | null

/** Adds the SaaS capability to the session the server gives (none when `saas` is null) */
async function stubSaas(context: BrowserContext, saas: Saas): Promise<void> {
  await context.route('**/.well-known/jmap', async route => {
    const response = await route.fetch()
    const session = (await response.json()) as {
      capabilities: Record<string, unknown>
      accounts: Record<string, { accountCapabilities: Record<string, unknown> }>
    }
    if (saas !== null) {
      session.capabilities[SAAS] = saas
      for (const account of Object.values(session.accounts)) {
        account.accountCapabilities[SAAS] = saas
      }
    }
    await route.fulfill({ response, json: session })
  })
  // The hosts of the paywall do not exist: a page stands for the Workplace
  await context.route(PAYWALL_HOSTS, route =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Paywall</title><h1>Paywall</h1>'
    })
  )
}

/** Fills the storage of the user up to its limit: the quota is full */
async function fillStorage(jmap: JmapClient, email: string): Promise<void> {
  await jmap.sendEmail({
    to: email,
    subject: 'Heavy',
    text: 'x',
    attachments: [
      { name: 'notes.txt', type: 'text/plain', content: 'x'.repeat(30_000) }
    ]
  })
  await jmap.waitForEmail({ subject: 'Heavy' })
  const storage = (await jmap.getQuotas()).find(
    quota => quota.resourceType === 'octets'
  )
  expect(storage?.used).toBeGreaterThan(30_000)
  await new WebAdminClient().setUserQuota(email, { size: storage?.used ?? 0 })
}

async function loginInWorkplace(
  page: Page,
  user: { email: string; password: string }
): Promise<FrameLocator> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto(WORKPLACE)
  const app = page.frameLocator('iframe[title="Twake Mail"]')
  await app.getByTestId('login-username-input').fill(user.email)
  await app.getByTestId('login-password-input').fill(user.password)
  await app.getByTestId('login-submit-button').click()
  await expect(app.getByTestId('mailbox-tree')).toBeVisible()
  return app
}

test.describe('STORAGE storage upgrade', () => {
  // A limit to start with, which the spec lowers to what is used
  test.use({ userQuota: { size: 50_000_000 } })

  test('STORAGE-01 inside Twake Workplace with the SaaS capability, a full storage links to the paywall from the banner, the sidebar and Settings > Storage, each in a new tab cut from the page', async ({
    page,
    context,
    user,
    jmap
  }) => {
    await stubSaas(context, { isPaying: false, canUpgrade: true })
    await fillStorage(jmap, user.email)
    const app = await loginInWorkplace(page, user)
    const paywall = `https://${user.localPart}.workplace.example.test/settings/premium`

    // The banner
    const banner = app.getByTestId('quota-banner')
    await expect(banner).toContainText('You have run out of storage space')
    await expect(banner).toContainText('cleaning up or upgrading your storage')
    const bannerLink = app.getByTestId('quota-banner-upgrade-link')
    await expect(bannerLink).toHaveText('Manage my storage')
    await expect(bannerLink).toHaveAttribute('href', paywall)
    await expect(bannerLink).toHaveAttribute('target', '_blank')
    await expect(bannerLink).toHaveAttribute('rel', 'noopener noreferrer')

    // The sidebar footer: gauge, caption, and the link
    await expect(app.getByTestId('quota-indicator')).toContainText('Storage')
    await expect(app.getByTestId('sidebar-version')).toContainText('version')
    const sidebarLink = app.getByTestId('quota-upgrade-link')
    await expect(sidebarLink).toHaveText('Increase your space')
    await expect(sidebarLink).toHaveAttribute('href', paywall)
    await expectNoA11yViolations(page)

    // The link opens the paywall in a new tab, which has no hold on this page
    const popupPromise = page.waitForEvent('popup')
    await sidebarLink.click()
    const popup = await popupPromise
    await expect(popup).toHaveURL(paywall)
    expect(await popup.evaluate(() => window.opener)).toBeNull()
    await popup.close()

    // Settings > Storage
    await app.getByRole('button', { name: 'Manage account' }).click()
    await app.getByTestId('settings-menu-item').click()
    await app.getByTestId('settings-menu-storage').click()
    await expect(app.getByTestId('storage-settings')).toContainText(
      'The storage is almost full'
    )
    const settingsButton = app.getByTestId('storage-upgrade-button')
    await expect(settingsButton).toHaveText('Upgrade storage')
    await expect(settingsButton).toHaveAttribute('href', paywall)
    await expectNoA11yViolations(page)
  })

  test('STORAGE-02 a message the full storage refuses says so, with the way to the paywall', async ({
    page,
    context,
    user,
    jmap
  }) => {
    await stubSaas(context, { canUpgrade: true })
    await fillStorage(jmap, user.email)
    const app = await loginInWorkplace(page, user)

    await app.getByTestId('compose-email-button').click()
    const composer = app.getByTestId('composer').first()
    await composer.getByTestId('composer-to-input').fill(user.email)
    await composer.getByTestId('composer-to-input').press('Enter')
    await composer.getByTestId('composer-subject-input').fill('Refused')
    await composer.getByTestId('composer-editor').click()
    await page.keyboard.type('Does not fit')
    await composer.getByTestId('composer-send-button').click()

    const error = composer.getByTestId('composer-send-error')
    await expect(error).toContainText('over quota')
    await expect(error.getByTestId('composer-upgrade-link')).toHaveAttribute(
      'href',
      `https://${user.localPart}.workplace.example.test/settings/premium`
    )
    await expectNoA11yViolations(page)
  })

  for (const [name, saas, isInsideWorkplace] of [
    ['outside of Twake Workplace', { canUpgrade: true }, false],
    ['without the SaaS capability', null, true],
    ['without the possibility to upgrade', { canUpgrade: false }, true],
    ['on the highest subscription', { isPaying: true, canUpgrade: false }, true]
  ] as const) {
    test(`STORAGE-03 ${name}, a full storage only advises to clean up: no link to a paywall`, async ({
      page,
      context,
      user,
      jmap
    }) => {
      await stubSaas(context, saas)
      await fillStorage(jmap, user.email)
      const app = isInsideWorkplace ? await loginInWorkplace(page, user) : page
      if (!isInsideWorkplace) await new LoginPage(page).loginAs(user)

      const banner = app.getByTestId('quota-banner')
      await expect(banner).toContainText('You have run out of storage space')
      await expect(banner).toContainText('please consider cleaning up.')
      await expect(banner).not.toContainText('upgrading')
      await expect(app.getByTestId('quota-indicator')).toBeVisible()
      await expect(app.getByTestId('quota-banner-upgrade-link')).toHaveCount(0)
      await expect(app.getByTestId('quota-upgrade-link')).toHaveCount(0)
      await expectNoA11yViolations(page)
    })
  }
})
