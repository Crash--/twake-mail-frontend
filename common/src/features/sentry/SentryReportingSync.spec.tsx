import { webcrypto } from 'node:crypto'

import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { sentryLifecycle, stopSentryReporting } from '@common/app/sentry'
import { resolveConfig, type AppConfig } from '@common/config/config'
import { PreferencesSettings } from '@common/features/settings/PreferencesSettings'
import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import {
  FAKE_ACCOUNT_ID,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeSettings
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { SentryReportingSync } from './SentryReportingSync'

jest.mock('@common/app/sentry', () => ({
  sentryLifecycle: { apply: jest.fn() },
  stopSentryReporting: jest.fn()
}))

const apply = jest.mocked(sentryLifecycle.apply)
const stop = jest.mocked(stopSentryReporting)

const DSN = 'https://publickey@sentry.example.com/42'

const BASE_SOURCE = {
  SERVER_URL: 'https://jmap.example.com',
  AUTH_MODE: 'basic',
  APP_VERSION: '1.2.3'
}

function makeConfig(source: Record<string, unknown>): AppConfig {
  const result = resolveConfig(
    { ...BASE_SOURCE, ...source },
    'https://mail.example.com',
    () => undefined
  )
  if (!result.ok) throw new Error(result.errors.join(', '))
  return result.value
}

const ENV_CONFIG = makeConfig({
  SENTRY_ENABLED: 'true',
  SENTRY_DSN: DSN,
  SENTRY_ENVIRONMENT: 'production'
})
const ECOSYSTEM_CONFIG = makeConfig({})

const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()

function answerEcosystem(document: unknown): void {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(document), { status: 200 })
  )
}

function ecosystemOf(section: Record<string, unknown>): unknown {
  return { sentry: section }
}

interface Scenario {
  config?: AppConfig
  settings?: Record<string, string>
  withSettingsCapability?: boolean
  ui?: ReactElement
}

function renderSync({
  config = ENV_CONFIG,
  settings = {},
  withSettingsCapability = true,
  ui = <SentryReportingSync />
}: Scenario = {}): {
  server: FakeJmapServer
  saved: () => Record<string, string>
  unmount: () => void
} {
  const server = makeFakeJmapServer({
    capabilities: withSettingsCapability ? FAKE_LINAGORA_CAPABILITIES : {}
  })
  const { settings: saved } = installFakeSettings(server, settings)
  const { unmount } = renderWithProviders(ui, {
    jmapServer: server,
    withJmapSession: true,
    config
  })
  return { server, saved, unmount }
}

/** What `apply` was last called with, once it has been called */
async function lastReporting(): Promise<unknown> {
  await waitFor(() => {
    expect(apply).toHaveBeenCalled()
  })
  return apply.mock.calls.at(-1)?.[0]
}

// jsdom has no Web Crypto
beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
})

describe('SentryReportingSync', () => {
  beforeEach(() => {
    globalThis.fetch = fetchMock
    apply.mockResolvedValue(undefined)
    answerEcosystem(ecosystemOf({ userOptInByDefault: false }))
  })

  it('starts the reporting for a user who opted in, identified by a pseudonym', async () => {
    renderSync({ settings: { 'sentry.user-opt-in': 'true' } })

    const reporting = (await lastReporting()) as {
      setup: unknown
      userId: string
    }
    expect(reporting.setup).toEqual({
      dsn: DSN,
      environment: 'production',
      release: '1.2.3',
      feedbackEnabled: false
    })
    expect(reporting.userId).toMatch(/^[0-9a-f]{16}$/)
    expect(reporting.userId).not.toContain(FAKE_ACCOUNT_ID)
  })

  it('turns the feedback on with its flag, whatever the source of the DSN', async () => {
    renderSync({
      config: makeConfig({
        SENTRY_ENABLED: 'true',
        SENTRY_DSN: DSN,
        SENTRY_FEEDBACK_ENABLED: 'true'
      }),
      settings: { 'sentry.user-opt-in': 'true' }
    })
    expect(await lastReporting()).toMatchObject({
      setup: { feedbackEnabled: true }
    })

    cleanup()
    apply.mockClear()
    answerEcosystem(
      ecosystemOf({ enabled: true, dsn: DSN, environment: 'staging' })
    )
    renderSync({
      config: makeConfig({ SENTRY_FEEDBACK_ENABLED: 'true' }),
      settings: { 'sentry.user-opt-in': 'true' }
    })
    expect(await lastReporting()).toMatchObject({
      setup: { dsn: DSN, environment: 'staging', feedbackEnabled: true }
    })
  })

  it('does not start without a choice when the default is off', async () => {
    renderSync()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(stop).toHaveBeenCalled()
    })
    expect(apply).not.toHaveBeenCalled()
  })

  it('starts without a choice when the ecosystem opts users in by default', async () => {
    answerEcosystem(ecosystemOf({ userOptInByDefault: true }))
    renderSync()

    expect(await lastReporting()).toMatchObject({ setup: { dsn: DSN } })
  })

  it('does not start while the default is not known', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined))
    renderSync()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(apply).not.toHaveBeenCalled()
  })

  it('honours the choice of the user over the default, both ways', async () => {
    answerEcosystem(ecosystemOf({ userOptInByDefault: true }))
    renderSync({ settings: { 'sentry.user-opt-in': 'false' } })

    await waitFor(() => {
      expect(stop).toHaveBeenCalled()
    })
    expect(apply).not.toHaveBeenCalled()
  })

  it('keeps an explicit opt-in when the ecosystem cannot be read', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderSync({ settings: { 'sentry.user-opt-in': 'true' } })

    expect(await lastReporting()).toMatchObject({ setup: { dsn: DSN } })
  })

  it('never starts when the server cannot keep the choice', async () => {
    answerEcosystem(ecosystemOf({ userOptInByDefault: true }))
    renderSync({ withSettingsCapability: false })

    await waitFor(() => {
      expect(stop).toHaveBeenCalled()
    })
    expect(apply).not.toHaveBeenCalled()
  })

  it('does not even ask the server when the environment turns it off', async () => {
    renderSync({
      config: makeConfig({ SENTRY_ENABLED: 'false', SENTRY_DSN: DSN }),
      settings: { 'sentry.user-opt-in': 'true' }
    })

    await waitFor(() => {
      expect(stop).toHaveBeenCalled()
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
  })

  it('takes the configuration from the ecosystem when the environment has none', async () => {
    answerEcosystem(
      ecosystemOf({
        enabled: true,
        dsn: DSN,
        environment: 'staging',
        userOptInByDefault: true
      })
    )
    renderSync({ config: ECOSYSTEM_CONFIG })

    expect(await lastReporting()).toMatchObject({
      setup: {
        dsn: DSN,
        environment: 'staging',
        release: '1.2.3',
        feedbackEnabled: false
      }
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://jmap.example.com/.well-known/linagora-ecosystem',
      expect.anything()
    )
  })

  it.each([
    ['not enabled', { enabled: false, dsn: DSN, environment: 'x' }],
    ['without a DSN', { enabled: true, environment: 'x' }],
    ['without an environment', { enabled: true, dsn: DSN }],
    [
      'with a DSN that is not https',
      { enabled: true, dsn: 'http://k@sentry.example.com/1', environment: 'x' }
    ]
  ])('ignores an ecosystem configuration %s', async (_label, section) => {
    answerEcosystem(ecosystemOf({ ...section, userOptInByDefault: true }))
    renderSync({
      config: ECOSYSTEM_CONFIG,
      settings: { 'sentry.user-opt-in': 'true' }
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(stop).toHaveBeenCalled()
    })
    expect(apply).not.toHaveBeenCalled()
  })

  it('stops the reporting when the session ends', async () => {
    const { unmount } = renderSync({
      settings: { 'sentry.user-opt-in': 'true' }
    })
    await lastReporting()
    stop.mockClear()

    unmount()

    expect(stop).toHaveBeenCalled()
  })
})

describe('Settings > Preferences, error reporting', () => {
  beforeEach(() => {
    globalThis.fetch = fetchMock
    apply.mockResolvedValue(undefined)
    answerEcosystem(ecosystemOf({ userOptInByDefault: false }))
  })

  function section(): SettingsSection {
    const found = SETTINGS_SECTIONS.find(({ id }) => id === 'preferences')
    if (!found) throw new Error('No Preferences section')
    return found
  }

  it('lets the user opt in and out, stored with the account', async () => {
    const { saved } = renderSync({
      ui: (
        <>
          <SentryReportingSync />
          <PreferencesSettings section={section()} />
        </>
      )
    })

    const toggle = await screen.findByRole('switch', {
      name: 'Send error reports'
    })
    expect(toggle).not.toBeChecked()
    expect(apply).not.toHaveBeenCalled()

    await userEvent.click(toggle)
    await waitFor(() => {
      expect(toggle).toBeChecked()
    })
    expect(saved()).toEqual({ 'sentry.user-opt-in': 'true' })
    expect(await lastReporting()).toMatchObject({ setup: { dsn: DSN } })

    apply.mockClear()
    stop.mockClear()
    await userEvent.click(toggle)
    await waitFor(() => {
      expect(toggle).not.toBeChecked()
    })
    expect(saved()).toEqual({ 'sentry.user-opt-in': 'false' })
    await waitFor(() => {
      expect(stop).toHaveBeenCalled()
    })
    expect(apply).not.toHaveBeenCalled()
  })

  it('shows the default of the ecosystem until the user chooses', async () => {
    answerEcosystem(ecosystemOf({ userOptInByDefault: true }))
    renderSync({ ui: <PreferencesSettings section={section()} /> })

    const toggle = await screen.findByRole('switch', {
      name: 'Send error reports'
    })
    await waitFor(() => {
      expect(toggle).toBeChecked()
    })
  })

  it('is hidden when error reporting is not configured', async () => {
    renderSync({
      config: makeConfig({ SENTRY_ENABLED: 'false' }),
      ui: <PreferencesSettings section={section()} />
    })

    await screen.findByRole('switch', { name: 'Enable thread' })
    expect(screen.queryByRole('switch', { name: 'Send error reports' })).toBe(
      null
    )
  })

  it('is hidden when the server cannot keep the choice', async () => {
    renderSync({
      withSettingsCapability: false,
      ui: <PreferencesSettings section={section()} />
    })

    await screen.findByRole('switch', { name: 'Enable thread' })
    expect(screen.queryByRole('switch', { name: 'Send error reports' })).toBe(
      null
    )
  })
})
