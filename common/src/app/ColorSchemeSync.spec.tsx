import { useTheme } from '@linagora/twake-mui'
import { act, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'

import { HIGH_CONTRAST_COLORS } from '@/ds/HighContrast/highContrast'
import {
  HIGH_CONTRAST_PREFERENCE_STORAGE_KEY,
  highContrastPreference
} from '@common/features/settings/accessibilityPreference'
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

  describe('high-contrast mode', () => {
    afterEach(() => {
      window.localStorage.removeItem(HIGH_CONTRAST_PREFERENCE_STORAGE_KEY)
    })

    // The primary colour of the light scheme of the theme
    function LightPrimary(): ReactElement {
      const theme = useTheme()
      return <p>{theme.colorSchemes.light?.palette.primary.main}</p>
    }

    it('is light and darker, over the dark theme, which comes back after', async () => {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark')
      window.localStorage.setItem(HIGH_CONTRAST_PREFERENCE_STORAGE_KEY, 'true')
      renderWithProviders(<LightPrimary />)

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe(
          'light'
        )
      })
      expect(screen.getByText(HIGH_CONTRAST_COLORS.primary)).toBeInTheDocument()

      act(() => {
        highContrastPreference.write(false)
      })
      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      })
      expect(screen.queryByText(HIGH_CONTRAST_COLORS.primary)).toBe(null)
    })

    it('follows `prefers-contrast: more` until the user chooses', async () => {
      const original = Object.getOwnPropertyDescriptor(window, 'matchMedia')
      window.matchMedia = (query: string): MediaQueryList => ({
        matches: query.includes('prefers-contrast: more'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
      })
      try {
        renderWithProviders(<LightPrimary />)
        await waitFor(() => {
          expect(
            screen.getByText(HIGH_CONTRAST_COLORS.primary)
          ).toBeInTheDocument()
        })

        act(() => {
          highContrastPreference.write(false)
        })
        await waitFor(() => {
          expect(screen.queryByText(HIGH_CONTRAST_COLORS.primary)).toBe(null)
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
})
