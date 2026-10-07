import type { Page } from '@playwright/test'

import { LoginPage, MailboxPage } from '../pages'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'

/**
 * The Docker image started as the Helm chart of Linagora's tmail-frontend starts
 * tmail-flutter's: no .env.js, an env.file and an app_dashboard.json mounted at the paths of
 * the chart, port 80, no CSP variable, the JMAP server on another origin than the app
 * (localhost, not 127.0.0.1). The Content-Security-Policy violations of the page fail every
 * test (support/fixtures.ts): the policy the image derives from the env.file must be enough.
 *
 *   E2E_CHART_IMAGE=twake-mail-frontend:e2e ./scripts/start-chart.sh           (no SSO)
 *   E2E_OIDC=1 E2E_CHART_IMAGE=twake-mail-frontend:e2e ./scripts/start-chart.sh (Dex by WebFinger)
 *   npx playwright test tests/chart-image.spec.ts
 */

async function getRuntimeConfig(): Promise<string> {
  try {
    return await (await fetch(`${env.baseUrl}/.env.js`)).text()
  } catch {
    return ''
  }
}

async function doesStackAnswerWebFinger(): Promise<boolean> {
  try {
    const response = await fetch(
      `${env.baseUrl}/.well-known/webfinger?resource=${encodeURIComponent(env.baseUrl)}&rel=http://openid.net/specs/connect/1.0/issuer`
    )
    return response.ok
  } catch {
    return false
  }
}

let isChartStack = false
let hasWebFinger = false

test.describe('CHART the image under the chart of tmail-frontend', () => {
  test.beforeAll(async () => {
    isChartStack = /COZY_INTEGRATION\s*=\s*'true'/.test(
      await getRuntimeConfig()
    )
    hasWebFinger = await doesStackAnswerWebFinger()
  })

  test.beforeEach(() => {
    test.skip(
      !isChartStack,
      'needs the image started as the chart does: E2E_CHART_IMAGE=<image> ./scripts/start-chart.sh'
    )
  })

  test('CHART-01 without an SSO to find, the Basic form signs in', async ({
    page,
    user
  }) => {
    test.skip(hasWebFinger, 'the stack answers WebFinger: CHART-02')

    // JMAP is on another origin than the app: its origin is in the policy of the image
    const login = await new LoginPage(page).goto()
    await expect(login.ssoButton).toHaveCount(0)
    const mailbox = await login.loginAs(user)
    await mailbox.expectFolderSelected({ role: 'inbox' })

    // app_dashboard.json is served but not read: the apps are those of the platform bar
    await expect(page.getByTestId('twake-bar')).toBeVisible()
  })

  test('CHART-02 the SSO found by WebFinger on SERVER_URL signs in', async ({
    page
  }) => {
    test.skip(
      !hasWebFinger,
      'needs WebFinger: E2E_OIDC=1 ./scripts/start-chart.sh'
    )

    const requests: string[] = []
    page.on('request', request => {
      if (request.url().includes('/.well-known/webfinger')) {
        requests.push(request.url())
      }
    })

    await signInWithDex(page)

    expect(requests.length).toBeGreaterThan(0)
    const asked = new URL(requests[0] ?? env.baseUrl)
    expect(asked.origin).toBe(new URL(await serverUrl()).origin)
    expect(asked.searchParams.get('rel')).toBe(
      'http://openid.net/specs/connect/1.0/issuer'
    )
    await expect(page.getByTestId('twake-bar')).toBeVisible()
  })
})

async function serverUrl(): Promise<string> {
  const match = /SERVER_URL\s*=\s*'([^']*)'/.exec(await getRuntimeConfig())
  return match?.[1] ?? env.baseUrl
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
