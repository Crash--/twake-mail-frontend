import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Language' }),
      'Vietnamese - Tiếng Việt'
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
