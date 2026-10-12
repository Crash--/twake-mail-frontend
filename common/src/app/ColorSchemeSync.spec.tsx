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

  it('follows the system with `auto`', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    // A system in the dark scheme
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    })
    try {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'auto')
      renderWithProviders(<div />)

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      })
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(window, 'matchMedia')
      } else {
        Object.defineProperty(window, 'matchMedia', original)
      }
    }
  })
})
