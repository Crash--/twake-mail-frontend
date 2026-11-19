import { LoginPage } from '../pages'
import { doesStackAnswerWebFinger, isChartStack } from '../support/chart'
import { expect, test } from '../support/fixtures'

/**
 * The Docker image started as the Helm chart of Linagora's tmail-frontend starts
 * tmail-flutter's: no .env.js, an env.file and an app_dashboard.json mounted at the paths of
 * the chart, port 80, no CSP variable, the JMAP server on another origin than the app
 * (localhost, not 127.0.0.1). The Content-Security-Policy violations of the page fail every
 * test (support/fixtures.ts): the policy the image derives from the env.file must be enough.
 * Without an SSO here; with one: chart-image-sso.spec.ts.
 *
 *   E2E_CHART_IMAGE=twake-mail-frontend:e2e ./scripts/start-chart.sh
 *   E2E_SUITE=chart npx playwright test
 */

test.describe('CHART the image under the chart of tmail-frontend', () => {
  test.beforeAll(async () => {
    expect(
      await isChartStack(),
      'needs the image started as the chart does: E2E_CHART_IMAGE=<image> ./scripts/start-chart.sh'
    ).toBe(true)
    expect(
      await doesStackAnswerWebFinger(),
      'the stack answers WebFinger: start-chart.sh without E2E_OIDC=1'
    ).toBe(false)
  })

  test('CHART-01 without an SSO to find, the Basic form signs in', async ({
    page,
    user
  }) => {
    // JMAP is on another origin than the app: its origin is in the policy of the image
    const login = await new LoginPage(page).goto()
    await expect(login.ssoButton).toHaveCount(0)
    const mailbox = await login.loginAs(user)
    await mailbox.expectFolderSelected({ role: 'inbox' })

    // app_dashboard.json is served but not read: the apps are those of the platform bar
    await expect(page.getByTestId('twake-bar')).toBeVisible()
  })
})
