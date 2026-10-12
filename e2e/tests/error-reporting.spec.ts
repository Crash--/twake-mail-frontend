import type { Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test, type E2EUser } from '../support/fixtures'
import { openAccountMenuIfAny } from '../support/accountMenu'

/**
 * Error reporting (tmail-flutter's `sentry.user-opt-in` preference), against
 * a double: the ingest host of the DSN of docker/app-env.js does not exist,
 * the spec answers it and keeps what the app posted. Nothing leaves the
 * machine.
 */

const SETTINGS = 'com:linagora:params:jmap:settings'
const INGEST = 'https://sentry-stub.example.test/**'
const ECOSYSTEM = '**/.well-known/linagora-ecosystem'

interface Ingest {
  /** The envelopes (text) the app posted to the ingest host */
  envelopes: string[]
  /** Every request made to the ingest host, whatever its answer */
  requests: string[]
}

async function stubIngest(page: Page): Promise<Ingest> {
  const ingest: Ingest = { envelopes: [], requests: [] }
  page.on('request', request => {
    if (request.url().startsWith('https://sentry-stub.example.test/')) {
      ingest.requests.push(request.url())
    }
  })
  await page.route(INGEST, async route => {
    const request = route.request()
    if (request.method() === 'POST') {
      ingest.envelopes.push(request.postData() ?? '')
    }
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      json: { id: 'stub' }
    })
  })
  return ingest
}

/** An error nobody caught, thrown from the page as a bug would be */
async function throwUncaught(page: Page, message: string): Promise<void> {
  await page.evaluate(text => {
    setTimeout(() => {
      throw new Error(text)
    }, 0)
  }, message)
}

/** A `console.error` with a JMAP-like object, as the call sites of the app do */
async function logError(page: Page, message: string): Promise<void> {
  await page.evaluate(text => {
    console.error(text, {
      subject: 'Quarterly salary review',
      from: [{ name: 'Carol', email: 'carol@example.com' }],
      preview: 'Hi, attached the payslip'
    })
  }, message)
}

async function openPreferences(page: Page, user: E2EUser): Promise<void> {
  const mailbox = await new LoginPage(page).loginAs(user)
  const settings = await mailbox.openSettings()
  await settings.open('preferences')
}

function errorReportingSwitch(page: Page): ReturnType<Page['getByRole']> {
  return page.getByRole('switch', { name: 'Send error reports' })
}

test.describe('SET error reporting', () => {
  test('SET-10 nothing is sent before the user opts in; opting in and out starts and stops the reports without reloading', async ({
    page,
    user,
    jmap
  }) => {
    const ingest = await stubIngest(page)
    await openPreferences(page, user)
    // Same document all along: a reload would lose it
    await page.evaluate(() => {
      Object.assign(window, { e2eNoReload: true })
    })

    const toggle = errorReportingSwitch(page)
    await expect(toggle).toBeVisible()
    await expect(toggle).not.toBeChecked()
    await expectNoA11yViolations(page)

    // Off by default: an uncaught error and a logged one go nowhere
    await throwUncaught(page, 'bug before the consent')
    await logError(page, '[e2e] failure before the consent')
    await page.waitForTimeout(500)
    expect(ingest.requests).toEqual([])

    // On
    await toggle.click()
    await expect(toggle).toBeChecked()
    await expect
      .poll(async () => {
        const result = await jmap.call('Settings/get', { ids: null }, [
          SETTINGS
        ])
        return (result.list as { settings: Record<string, string> }[])[0]
          ?.settings
      })
      .toMatchObject({ 'sentry.user-opt-in': 'true' })
    await expect
      .poll(async () => {
        await throwUncaught(page, 'bug after opting in')
        return ingest.envelopes.join('\n')
      })
      .toContain('bug after opting in')
    await logError(page, '[e2e] failure after opting in')
    await expect
      .poll(() => ingest.envelopes.join('\n'))
      .toContain('[e2e] failure after opting in')

    // Nothing of the user, the mails nor the credentials is in what was sent
    const body = ingest.envelopes.join('\n')
    for (const secret of [
      user.email,
      user.localPart,
      user.password,
      'Quarterly salary review',
      'carol@example.com',
      'Carol',
      'payslip',
      'Bearer',
      'Basic '
    ]) {
      expect(body, `the reports must not contain ${secret}`).not.toContain(
        secret
      )
    }
    expect(body).toContain('"environment":"e2e"')
    expect(body).toMatch(/"user":\{"id":"[0-9a-f]{16}"\}/)
    expect(body).not.toContain('"type":"session"')
    expect(body).not.toContain('"type":"replay_event"')
    expect(body).not.toContain('"type":"transaction"')

    // Off again, at once
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await expect
      .poll(async () => {
        const result = await jmap.call('Settings/get', { ids: null }, [
          SETTINGS
        ])
        return (result.list as { settings: Record<string, string> }[])[0]
          ?.settings
      })
      .toMatchObject({ 'sentry.user-opt-in': 'false' })
    // Let the SDK close, then count
    await page.waitForTimeout(500)
    const sentBefore = ingest.requests.length
    await throwUncaught(page, 'bug after opting out')
    await logError(page, '[e2e] failure after opting out')
    await page.waitForTimeout(800)
    expect(ingest.requests).toHaveLength(sentBefore)
    expect(ingest.envelopes.join('\n')).not.toContain('after opting out')

    // On once more: a fresh client reports again
    await toggle.click()
    await expect(toggle).toBeChecked()
    await expect
      .poll(async () => {
        await throwUncaught(page, 'bug after opting in again')
        return ingest.envelopes.join('\n')
      })
      .toContain('bug after opting in again')
    expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)
  })

  test('SET-11 the choice belongs to the account: it comes back at the next sign-in, and another account of the same browser has none', async ({
    page,
    user,
    users
  }) => {
    const ingest = await stubIngest(page)
    await openPreferences(page, user)
    await errorReportingSwitch(page).click()
    await expect(errorReportingSwitch(page)).toBeChecked()

    // Credentials live in memory: a new page load asks for them again
    await page.goto('/')
    await openPreferences(page, user)
    await expect(errorReportingSwitch(page)).toBeChecked()
    await expect
      .poll(async () => {
        await throwUncaught(page, 'bug after the reload')
        return ingest.envelopes.join('\n')
      })
      .toContain('bug after the reload')

    // Signing out ends the reports, and forgets the user
    await openAccountMenuIfAny(page)
    await page.getByTestId('logout-button').click()
    await expect(page.getByTestId('login-username-input')).toBeVisible()
    await page.waitForTimeout(500)
    const sentBefore = ingest.requests.length
    await throwUncaught(page, 'bug after signing out')
    await page.waitForTimeout(800)
    expect(ingest.requests).toHaveLength(sentBefore)

    // Another account, same browser: the default applies (off)
    const other = await users.create({ prefix: 'other' })
    await page.goto('/')
    await openPreferences(page, other)
    await expect(errorReportingSwitch(page)).not.toBeChecked()
    await throwUncaught(page, 'bug of the other account')
    await page.waitForTimeout(800)
    expect(ingest.requests).toHaveLength(sentBefore)
  })

  test('SET-12 the server can opt its users in by default (ecosystem userOptInByDefault); the user can still opt out', async ({
    page,
    user
  }) => {
    await page.route(ECOSYSTEM, route =>
      route.fulfill({ json: { sentry: { userOptInByDefault: true } } })
    )
    const ingest = await stubIngest(page)
    await openPreferences(page, user)

    await expect(errorReportingSwitch(page)).toBeChecked()
    await expect
      .poll(async () => {
        await throwUncaught(page, 'bug with the default on')
        return ingest.envelopes.join('\n')
      })
      .toContain('bug with the default on')

    await errorReportingSwitch(page).click()
    await expect(errorReportingSwitch(page)).not.toBeChecked()
    await page.waitForTimeout(500)
    const sentBefore = ingest.requests.length
    await throwUncaught(page, 'bug after opting out of the default')
    await page.waitForTimeout(800)
    expect(ingest.requests).toHaveLength(sentBefore)
  })

  test('SET-13 expected errors are never reported: a failed network request, an aborted one', async ({
    page,
    user
  }) => {
    await page.route('**/e2e/network-down', route => route.abort('failed'))
    const ingest = await stubIngest(page)
    await openPreferences(page, user)
    await errorReportingSwitch(page).click()
    await expect(errorReportingSwitch(page)).toBeChecked()

    await page.evaluate(() => {
      const controller = new AbortController()
      fetch('/e2e/does-not-exist', { signal: controller.signal }).catch(
        (error: unknown) => {
          console.error('[e2e] request aborted', error)
        }
      )
      controller.abort()
      fetch('/e2e/network-down').catch((error: unknown) => {
        console.error('[e2e] network down', error)
      })
    })
    await page.waitForTimeout(1_000)
    // A real bug right after is reported: the SDK is alive, it chose to drop
    await throwUncaught(page, 'a real bug')
    await expect.poll(() => ingest.envelopes.join('\n')).toContain('a real bug')
    const body = ingest.envelopes.join('\n')
    expect(body).not.toContain('request aborted')
    expect(body).not.toContain('network down')
  })

  test('SET-15 the feedback button is offered only to a user who opted in; the feedback is posted to the ingest host with its message and no address of the account', async ({
    page,
    user
  }) => {
    const ingest = await stubIngest(page)
    await openPreferences(page, user)
    const button = page.getByTestId('twake-feedback-button')

    // Configured, but not opted in: no button, nothing posted
    await expect(errorReportingSwitch(page)).not.toBeChecked()
    await expect(button).toHaveCount(0)

    await errorReportingSwitch(page).click()
    await expect(errorReportingSwitch(page)).toBeChecked()
    await expect(button).toBeVisible()

    await expectNoA11yViolations(page)

    await button.click()
    await expect(page.getByRole('textbox', { name: 'What happened?' })).toBeVisible()
    await expectNoA11yViolations(page)
    await page
      .getByRole('textbox', { name: 'What happened?' })
      .fill('The folder list is slow to open')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.getByText('Thank you, your feedback has been sent.')).toBeVisible()
    await expect
      .poll(() => ingest.envelopes.join('\n'))
      .toContain('The folder list is slow to open')

    const body = ingest.envelopes.join('\n')
    expect(body).toContain('"type":"feedback"')
    expect(body).toContain('"app":"twake-mail"')
    expect(body).toMatch(/"user":\{"id":"[0-9a-f]{16}"\}/)
    for (const secret of [user.email, user.localPart, user.password]) {
      expect(body, `the feedback must not contain ${secret}`).not.toContain(
        secret
      )
    }

    // Opting out takes the button away at once
    await errorReportingSwitch(page).click()
    await expect(errorReportingSwitch(page)).not.toBeChecked()
    await expect(button).toHaveCount(0)
  })
})
