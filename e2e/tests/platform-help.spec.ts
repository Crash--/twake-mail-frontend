import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { stubCapabilities } from '../support/capabilities'
import { expect, test } from '../support/fixtures'

/**
 * The help of the mail (contact support) under the bar of Twake Workplace,
 * against the fake Workplace of the stack (docker/nginx/sso.conf), which
 * names no `help_link` of its own: the `oidc` suite (support/suites.ts).
 *
 *   E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh
 *   E2E_SUITE=oidc npx playwright test tests/platform-help.spec.ts
 */

const SUPPORT = 'com:linagora:params:jmap:contact:support'

test.describe('TBAR help under the Workplace bar', () => {
  test(
    'TBAR-06 under the Workplace bar the help button stays one tap away: in that bar on a desktop, in the bar of the mail below',
    { tag: '@mobile' },
    async ({ page }) => {
      await stubCapabilities(page, {
        [SUPPORT]: { httpLink: 'https://support.example.test/help' }
      })
      await new LoginPage(page).loginWithDex()

      await expect(page.getByTestId('twake-bar')).toHaveAttribute(
        'data-status',
        'ready'
      )
      // The desktop size of the app starts at 1200 px
      const isDesktop = (page.viewportSize()?.width ?? 0) >= 1200
      const bar = page.getByTestId(isDesktop ? 'twake-bar' : 'top-bar')
      const help = bar.getByTestId('help-button')
      await expect(help).toHaveAccessibleName('Get help or report a bug')
      await expect(help).toHaveAttribute(
        'href',
        'https://support.example.test/help'
      )
      await expectNoA11yViolations(page)
    }
  )
})
