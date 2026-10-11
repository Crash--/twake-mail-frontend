import type { Page } from '@playwright/test'

import { MailboxPage } from '../pages'
import {
  doesStackAnswerWebFinger,
  getServerUrl,
  isChartStack
} from '../support/chart'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'

/**
 * The Docker image started as the Helm chart of tmail-frontend does (see
 * chart-image.spec.ts), the stack answering WebFinger on SERVER_URL with Dex.
 *
 *   E2E_OIDC=1 E2E_CHART_IMAGE=twake-mail-frontend:e2e ./scripts/start-chart.sh
 *   E2E_OIDC=1 E2E_SUITE=chart-sso npx playwright test
 */

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

test.describe('CHART the image under the chart of tmail-frontend, with an SSO', () => {
  test.beforeAll(async () => {
    expect(
      await isChartStack(),
      'needs the image started as the chart does: E2E_OIDC=1 E2E_CHART_IMAGE=<image> ./scripts/start-chart.sh'
    ).toBe(true)
    expect(
      await doesStackAnswerWebFinger(),
      'needs WebFinger: E2E_OIDC=1 E2E_CHART_IMAGE=<image> ./scripts/start-chart.sh'
    ).toBe(true)
  })

  test('CHART-02 the SSO found by WebFinger on SERVER_URL signs in', async ({
    page
  }) => {
    const requests: string[] = []
    page.on('request', request => {
      if (request.url().includes('/.well-known/webfinger')) {
        requests.push(request.url())
      }
    })

    await signInWithDex(page)

    expect(requests.length).toBeGreaterThan(0)
    const asked = new URL(requests[0] ?? env.baseUrl)
    expect(asked.origin).toBe(new URL(await getServerUrl()).origin)
    expect(asked.searchParams.get('rel')).toBe(
      'http://openid.net/specs/connect/1.0/issuer'
    )
    await expect(page.getByTestId('twake-bar')).toBeVisible()
  })
})
