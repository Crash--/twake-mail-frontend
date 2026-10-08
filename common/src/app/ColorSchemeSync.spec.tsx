import { act, waitFor } from '@testing-library/react'

import {
  THEME_PREFERENCE_STORAGE_KEY,
  themePreference
} from '@common/features/settings/themePreference'
import { renderWithProviders } from '@common/testing/renderWithProviders'

describe('ColorSchemeSync', () => {
  afterEach(() => {
    window.localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY)
  })

  it('colours the page as the preference says, and follows it', async () => {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark')
    // AppProviders mounts the sync
    renderWithProviders(<div />)

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
    expect(document.documentElement.style.colorScheme).toBe('dark')

    act(() => {
      themePreference.write('light')
    })
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
