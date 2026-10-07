import type { Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

/** Widths in CSS pixels: no horizontal scrolling of the page nor of its main content */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector('[data-testid="main-content"]')
    return {
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      main: main === null ? 0 : main.scrollWidth - main.clientWidth
    }
  })
  expect(overflow).toEqual({ page: 0, main: 0 })
}

const LONG_SUBJECT =
  'Quarterly report about the budget review and the planning of the next release cycle with a supercalifragilisticexpialidocious word'

test.describe('RESP responsive layout', () => {
  // The reading view of a single email: the "Thread" setting off
  test.use({ emailsOneByOne: true })

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 640, height: 400 }
  ]) {
    test.describe(`at ${viewport.width} px`, () => {
      test.use({ viewport })

      test(`RESP-01 the screens reflow at ${viewport.width} px without horizontal scrolling`, async ({
        page,
        user,
        jmap
      }) => {
        // A browser window zoomed to 400 % (320 px) or 200 % (640 px): the
        // phone and tablet projects have their own screens
        test.skip(
          test.info().project.name !== 'chromium',
          'desktop browser zoom'
        )
        await jmap.sendEmail({
          to: user.email,
          subject: LONG_SUBJECT,
          text: 'Hello'
        })
        // The memory backend does not find long subjects: wait for a short one
        await jmap.sendEmail({
          to: user.email,
          subject: 'marker',
          text: 'Hello'
        })
        await jmap.waitForEmail({ subject: 'marker' })

        const login = await new LoginPage(page).goto()
        await expectNoHorizontalScroll(page)
        const mailbox = await login.loginAs(user)

        await expect(mailbox.emailRow(LONG_SUBJECT)).toBeVisible()
        await expectNoHorizontalScroll(page)
        await expectNoA11yViolations(page)

        await mailbox.showFolders()
        await expectNoHorizontalScroll(page)
        await mailbox.hideFolders()

        const email = await mailbox.openEmail(LONG_SUBJECT)
        await expect(email.from).toContainText(user.email)
        // The tooltip of the menu button, focused when the drawer closed,
        // fades out: axe would measure it half transparent
        await expect(page.getByRole('tooltip')).toHaveCount(0)
        await expectNoHorizontalScroll(page)
        await expectNoA11yViolations(page)
      })
    })
  }

  test('RESP-02 the folder drawer keeps the focus and gives it back', async ({
    page,
    user,
    isMobile
  }) => {
    test.skip(!isMobile, 'no drawer on a desktop')
    const mailbox = await new LoginPage(page).loginAs(user)
    const drawerHasFocus = (): Promise<boolean> =>
      page.evaluate(
        () =>
          document
            .querySelector('[data-testid="mailbox-drawer"]')
            ?.contains(document.activeElement) ?? false
      )

    await mailbox.folderMenuButton.click()
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
    await expect.poll(drawerHasFocus).toBe(true)
    await expectNoA11yViolations(page)
    for (let presses = 0; presses < 15; presses += 1) {
      await page.keyboard.press('Tab')
      expect(await drawerHasFocus()).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(mailbox.folderDrawer).toBeHidden()
    await expect(mailbox.folderMenuButton).toBeFocused()

    await mailbox.folderMenuButton.click()
    await page.getByTestId('mailbox-drawer-close-button').click()
    await expect(mailbox.folderDrawer).toBeHidden()
    await expect(mailbox.folderMenuButton).toBeFocused()
  })

  test('RESP-03 the search folds into the top bar of a phone', async ({
    page,
    user
  }) => {
    test.skip(test.info().project.name !== 'mobile', 'phones only')
    await new LoginPage(page).loginAs(user)

    await page.getByTestId('search-open-button').click()
    await expect(page.getByTestId('search-input')).toBeFocused()
    await expectNoA11yViolations(page)

    // Escape closes the suggestions (the quick filters alone under an
    // empty field) first, then folds the search
    const input = page.getByTestId('search-input')
    const quickFilters = page.getByTestId('quick-search-filters')
    await expect(quickFilters).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(quickFilters).toBeHidden()
    await expect(input).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('search-input')).toBeHidden()
    await expect(page.getByTestId('search-open-button')).toBeFocused()
  })

  test.describe('on a large tablet', () => {
    test.use({ viewport: { width: 1024, height: 768 } })

    test('RESP-04 the list stays beside the email being read', async ({
      page,
      user,
      jmap
    }) => {
      test.skip(test.info().project.name !== 'chromium', 'one run is enough')
      await jmap.sendEmail({ to: user.email, subject: 'first', text: 'one' })
      await jmap.waitForEmail({ subject: 'first' })
      await jmap.sendEmail({ to: user.email, subject: 'second', text: 'two' })
      await jmap.waitForEmail({ subject: 'second' })
      const mailbox = await new LoginPage(page).loginAs(user)
      await expect(page.getByTestId('email-view-empty')).toBeVisible()

      const email = await mailbox.openEmail('first')

      await expect(mailbox.emailRow('second')).toBeVisible()
      await expect(mailbox.emailRow('first').getByRole('link')).toHaveAttribute(
        'aria-current',
        'true'
      )
      await expectNoA11yViolations(page)

      await email.backButton.click()
      await expect(email.root).toBeHidden()
      await expect(page.getByTestId('email-view-empty')).toBeVisible()
      await expect(mailbox.emailRow('first').getByRole('link')).toBeFocused()
    })
  })

  test.describe('on a phone held sideways', () => {
    test.use({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true
    })

    test('RESP-05 the list and the email work in landscape', async ({
      page,
      user,
      jmap
    }) => {
      test.skip(test.info().project.name !== 'chromium', 'one run is enough')
      await jmap.sendEmail({
        to: user.email,
        subject: 'sideways',
        text: 'Hello'
      })
      await jmap.waitForEmail({ subject: 'sideways' })
      const mailbox = await new LoginPage(page).loginAs(user)

      const email = await mailbox.openEmail('sideways')
      await expect(email.body()).toContainText('Hello')
      await expectNoHorizontalScroll(page)
      await email.back()
      await expect(mailbox.emailRow('sideways')).toBeVisible()
    })
  })

  test.describe('on a desktop', () => {
    test.use({ viewport: { width: 1440, height: 789 } })

    test('RESP-06 the platform bar is 48 px high and the search sits in the page under it', async ({
      page,
      user
    }) => {
      test.skip(test.info().project.name !== 'chromium', 'desktop only')
      const mailbox = await new LoginPage(page).loginAs(user)

      const bar = await page.getByTestId('twake-bar').boundingBox()
      const search = await page.getByTestId('search-bar').boundingBox()
      const toolbar = await page.getByTestId('list-toolbar').boundingBox()
      const settings = await page.getByTestId('settings-button').boundingBox()
      const sidebar = await page.getByTestId('mailbox-tree').boundingBox()

      if (!bar || !search || !toolbar || !settings || !sidebar) {
        throw new Error('A part of the top of the page is not shown')
      }
      // Full width above the sidebar and the body
      expect(bar.x).toBe(0)
      expect(bar.width).toBe(1440)
      expect(bar.height).toBeGreaterThanOrEqual(48)
      expect(bar.height).toBeLessThanOrEqual(49)
      expect(sidebar.y).toBeGreaterThanOrEqual(bar.y + bar.height)
      // The search is in the body, under the bar, 820 px at most, and the
      // settings are at the far end of the same row
      expect(search.y).toBeGreaterThanOrEqual(bar.y + bar.height)
      expect(search.width).toBeLessThanOrEqual(820)
      expect(search.width).toBeGreaterThan(600)
      expect(settings.x).toBeGreaterThan(search.x + search.width)
      expect(
        Math.abs(
          settings.y + settings.height / 2 - (search.y + search.height / 2)
        )
      ).toBeLessThan(8)
      // The list toolbar is under the search
      expect(toolbar.y).toBeGreaterThanOrEqual(search.y + search.height)
      await expect(mailbox.selectionToolbar).toBeHidden()
      await expectNoA11yViolations(page)
    })
  })
})
