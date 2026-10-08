import { waitFor } from '@testing-library/react'

import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeSettings
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { ServerThemeSync } from './ServerThemeSync'
import { THEME_PREFERENCE_STORAGE_KEY } from './themePreference'

describe('ServerThemeSync', () => {
  afterEach(() => {
    window.localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY)
  })

  it('colours the app as the account says', async () => {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'light')
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeSettings(server, { 'appearance.theme': 'dark' })
    renderWithProviders(<ServerThemeSync />, {
      jmapServer: server,
      withJmapSession: true
    })

    await waitFor(() => {
      expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe(
        'dark'
      )
    })
  })

  it('goes back to light when the account says nothing', async () => {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark')
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeSettings(server, { language: 'fr' })
    renderWithProviders(<ServerThemeSync />, {
      jmapServer: server,
      withJmapSession: true
    })

    await waitFor(() => {
      expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe(
        'light'
      )
    })
  })

  it('keeps the copy of this browser while the server offers no settings', async () => {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark')
    const server = makeFakeJmapServer({ capabilities: {} })
    renderWithProviders(<ServerThemeSync />, {
      jmapServer: server,
      withJmapSession: true
    })

    await waitFor(() => {
      expect(document.querySelector('body')).not.toBe(null)
    })
    expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe(
      'dark'
    )
  })
})
