import { AppGrid, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'

/**
 * The app grid (`appList.js`, docker/app-list.js) and Twake Workplace: the
 * apps of the grid open in new tabs, the Drive at the address of the user;
 * inside an iframe of Workplace (`WORKPLACE_EMBEDDING`), the container
 * holds the logotype and the grid.
 */

const APPS_HOSTS = /^https:\/\/[^/]*workplace\.example\.test\//
/**
 * The page of a container, served by the stack on another origin than the
 * app (localhost, not 127.0.0.1), framing it (docker/nginx/default.conf)
 */
const WORKPLACE = `http://localhost:${new URL(env.baseUrl).port}/e2e/workplace.html`

test.describe('APPGRID app grid', () => {
  test.beforeEach(async ({ context }) => {
    // The hosts of the apps do not exist: a page standing for each app
    await context.route(APPS_HOSTS, route =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Twake app</title><h1>Twake app</h1>'
      })
    )
  })

  test(
    'APPGRID-01 the app grid lists the apps in order, each opened in a new tab, the Drive at the address of the user',
    { tag: '@mobile' },
    async ({ page, user }) => {
      await new LoginPage(page).loginAs(user)
      const grid = await new AppGrid(page).open()

      await expect(grid.items).toHaveText([
        'Twake Chat',
        'Twake Drive',
        'Twake Calendar'
      ])
      await expect(grid.item('Twake Drive')).toHaveAttribute(
        'href',
        `https://${user.localPart}-drive.workplace.example.test/`
      )
      await expectNoA11yViolations(page)

      for (const [name, url] of [
        ['Twake Chat', 'https://chat.workplace.example.test/'],
        [
          'Twake Drive',
          `https://${user.localPart}-drive.workplace.example.test/`
        ],
        ['Twake Calendar', 'https://calendar.workplace.example.test/']
      ] as const) {
        if (!(await grid.list.getByRole('menu').isVisible())) await grid.open()
        const app = await grid.launch(name)
        await expect(app).toHaveURL(url)
        await app.close()
        // Back to Twake Mail, the grid still lists the same apps
        await grid.open()
        await expect(grid.items).toHaveCount(3)
        await page.keyboard.press('Escape')
      }
    }
  )

  test('APPGRID-02 inside an iframe of Twake Workplace the logotype and the app grid are left to the container', async ({
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
    await expect(app.getByTestId('app-grid-toggle-button')).toHaveCount(0)
    await expect(app.getByRole('img', { name: 'Twake Mail' })).toHaveCount(0)
    // A gear opens the account menu: its settings
    await app.getByRole('button', { name: 'Manage account' }).click()
    await expect(app.getByTestId('settings-menu-item')).toBeVisible()
  })
})
