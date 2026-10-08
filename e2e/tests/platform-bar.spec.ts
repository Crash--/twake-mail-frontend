import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'
import { openAccountMenuIfAny } from '../support/accountMenu'

/**
 * The platform bar of Twake Workplace (@linagora/twake-bar) at the top of the app.
 * The stack has no Workplace: the bar shows the logotype and a log out button
 * instead of the menus of the platform. Inside an iframe of the Workplace
 * (`WORKPLACE_EMBEDDING`), the container shows the bar.
 */

/**
 * The page of a container, served by the stack on another origin than the
 * app (localhost, not 127.0.0.1), framing it (docker/nginx/default.conf)
 */
const WORKPLACE = `http://localhost:${new URL(env.baseUrl).port}/e2e/workplace.html`

test.describe('APPGRID platform bar', () => {
  test(
    'APPGRID-03 without a Workplace the platform bar (the drawer below the desktop size) shows the logotype and signs out',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.expectFolderSelected({ role: 'inbox' })

      if (['mobile', 'tablet'].includes(test.info().project.name)) {
        // As tmail-flutter without the platform: the bar of the mail alone,
        // the drawer holds the log out
        await expect(page.getByTestId('twake-bar')).toHaveCount(0)
        await mailbox.showFolders()
        const header = page.getByTestId('drawer-header')
        await expect(header.getByRole('img', { name: 'Twake Mail' })).toBeVisible()
        await expectNoA11yViolations(page)
        await header.getByTestId('logout-button').click()
        await expect(page.getByTestId('login-username-input')).toBeVisible()
        return
      }
      const bar = page.getByTestId('twake-bar')
      await expect(bar).toHaveAttribute('data-status', 'public')
      await expect(bar.getByTestId('twake-bar-apps-button')).toHaveCount(0)
      await expectNoA11yViolations(page)

      await openAccountMenuIfAny(page)
      await page.getByTestId('logout-button').click()
      await expect(page.getByTestId('login-username-input')).toBeVisible()
    }
  )

  test('APPGRID-02 inside an iframe of Twake Workplace the platform bar is left to the container', async ({
    page,
    user
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto(WORKPLACE)
    const app = page.frameLocator('iframe[title="Twake Mail"]')
    await app.getByTestId('login-username-input').fill(user.email)
    await app.getByTestId('login-password-input').fill(user.password)
    await app.getByTestId('login-submit-button').click()

    await expect(app.getByTestId('mailbox-tree')).toBeVisible()
    await expect(app.getByTestId('twake-bar')).toHaveCount(0)
    // The settings stay in the page
    await app.getByTestId('settings-button').click()
    await expect(app.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
