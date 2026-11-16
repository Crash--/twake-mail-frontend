import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { resolveConfig, type AppConfig } from '@common/config/config'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeSettings
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { LanguageSettings } from './LanguageSettings'
import { SETTINGS_SECTIONS, type SettingsSection } from './sections'
import { ServerLanguageSync } from './ServerLanguageSync'

function languageSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'language-region')
  if (!section) throw new Error('No Language section')
  return section
}

function makeConfig(allowedLanguages: string): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      ALLOWED_LANGUAGES: allowedLanguages
    },
    'https://mail.example.com',
    () => undefined
  )
  if (!result.ok) throw new Error(result.errors.join(', '))
  return result.value
}

describe('LanguageSettings', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('shows the app in the language picked, kept here and on the server', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    const settings = installFakeSettings(server)
    renderWithProviders(<LanguageSettings section={languageSection()} />, {
      jmapServer: server,
      withJmapSession: true
    })

    // As tmail-flutter: the field names the language, its menu lists each
    // language in the language of the app and in its own
    const field = await screen.findByRole('combobox', { name: /^Language/ })
    expect(field).toHaveTextContent('English')
    await userEvent.click(field)
    await userEvent.click(
      screen.getByRole('option', { name: 'Vietnamese - Tiếng Việt' })
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ngôn ngữ' })
    ).toBeVisible()
    expect(document.documentElement.lang).toBe('vi')
    expect(window.localStorage.getItem('lang')).toBe('vi')
    await waitFor(() => {
      expect(settings.settings()).toEqual({ language: 'vi' })
    })
  })

  it('offers the languages of tmail-flutter but Arabic, and Spanish', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeSettings(server)
    renderWithProviders(<LanguageSettings section={languageSection()} />, {
      jmapServer: server,
      withJmapSession: true
    })

    await userEvent.click(
      await screen.findByRole('combobox', { name: /^Language/ })
    )
    expect(
      screen.getAllByRole('option').map(option => option.textContent)
    ).toEqual([
      'English - English',
      'French - Français',
      'Russian - Русский',
      'Vietnamese - Tiếng Việt',
      'Italian - Italiano',
      'German - Deutsch',
      'Mongolian - Монгол',
      'Spanish - Español'
    ])

    await userEvent.click(
      screen.getByRole('option', { name: 'Mongolian - Монгол' })
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Хэл' })
    ).toBeVisible()
    expect(document.documentElement.lang).toBe('mn')
  })

  it('offers only the languages of ALLOWED_LANGUAGES, in their order', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeSettings(server)
    renderWithProviders(<LanguageSettings section={languageSection()} />, {
      jmapServer: server,
      withJmapSession: true,
      config: makeConfig('mn,en')
    })

    await userEvent.click(
      await screen.findByRole('combobox', { name: /^Language/ })
    )
    expect(
      screen.getAllByRole('option').map(option => option.textContent)
    ).toEqual(['Mongolian - Монгол', 'English - English'])
  })

  it('keeps its language when the account has one not offered', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    const settings = installFakeSettings(server, { language: 'fr' })
    renderWithProviders(
      <>
        <ServerLanguageSync />
        <LanguageSettings section={languageSection()} />
      </>,
      {
        jmapServer: server,
        withJmapSession: true,
        config: makeConfig('mn,en')
      }
    )

    expect(
      await screen.findByRole('combobox', { name: /^Language/ })
    ).toHaveTextContent('English')
    // Once the settings of the account are read
    await waitFor(() => {
      expect(
        server.requests.some(({ methodCalls }) =>
          methodCalls.some(([method]) => method === 'Settings/get')
        )
      ).toBe(true)
    })
    expect(
      screen.getByRole('heading', { level: 1, name: 'Language' })
    ).toBeVisible()
    // The setting of the account is not overwritten
    expect(settings.settings()).toEqual({ language: 'fr' })
  })

  it('follows the language of the account', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeSettings(server, { language: 'fr' })
    renderWithProviders(
      <>
        <ServerLanguageSync />
        <LanguageSettings section={languageSection()} />
      </>,
      { jmapServer: server, withJmapSession: true }
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Langue' })
    ).toBeVisible()
  })

  it('is not offered when the server keeps the language read-only', () => {
    expect(
      languageSection().isAvailable?.({
        capabilities: {
          'com:linagora:params:jmap:settings': {
            readOnlyProperties: ['language']
          }
        },
        accounts: {},
        primaryAccounts: {},
        username: 'alice@example.com',
        apiUrl: '',
        downloadUrl: '',
        uploadUrl: '',
        eventSourceUrl: '',
        state: 's'
      })
    ).toBe(false)
  })
})
