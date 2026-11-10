import { useCallback, useSyncExternalStore } from 'react'

import type { FocusIndicator } from '@/ds/FocusIndicator/focusIndicator'

import { createLocalPreference } from './localPreference'

/**
 * The "Accessibility" preference (Settings > Preferences, not in
 * tmail-flutter): a thick outline on whatever has the keyboard focus,
 * instead of the discreet look of the theme. Off by default, kept in this
 * browser.
 */
export const ACCESSIBILITY_PREFERENCE_STORAGE_KEY =
  'twake-mail.preferences.enhancedFocus'

export const accessibilityPreference = createLocalPreference<boolean>({
  key: ACCESSIBILITY_PREFERENCE_STORAGE_KEY,
  parse: raw => raw === 'true',
  serialize: String
})

export interface AccessibilityPreference {
  isEnabled: boolean
  setEnabled: (isEnabled: boolean) => void
}

export function useAccessibilityPreference(): AccessibilityPreference {
  const isEnabled = accessibilityPreference.useValue()
  const setEnabled = useCallback((value: boolean) => {
    accessibilityPreference.write(value)
  }, [])
  return { isEnabled, setEnabled }
}

/**
 * The high-contrast mode (Settings > Preferences, the account menu and the
 * login page, not in tmail-flutter): darker texts, visible borders and a
 * thick black focus outline. Kept in this browser, so that it applies
 * before sign-in too, also read by the inline script of
 * `public/index.html`. Null when never chosen: the system decides
 * (`prefers-contrast: more`).
 */
export const HIGH_CONTRAST_PREFERENCE_STORAGE_KEY =
  'twake-mail.preferences.highContrast'

export const highContrastPreference = createLocalPreference<boolean | null>({
  key: HIGH_CONTRAST_PREFERENCE_STORAGE_KEY,
  parse: raw => {
    if (raw === 'true') return true
    if (raw === 'false') return false
    return null
  },
  serialize: String
})

/** The system setting the mode follows when the user never chose */
export const PREFERS_MORE_CONTRAST_QUERY = '(prefers-contrast: more)'

function contrastQuery(): MediaQueryList | null {
  // jsdom and old browsers have no `matchMedia`
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(PREFERS_MORE_CONTRAST_QUERY)
    : null
}

function subscribeToSystemContrast(listener: () => void): () => void {
  const query = contrastQuery()
  query?.addEventListener('change', listener)
  return () => {
    query?.removeEventListener('change', listener)
  }
}

function prefersMoreContrast(): boolean {
  return contrastQuery()?.matches ?? false
}

/** Whether the system asks for more contrast, following its changes */
function useSystemPrefersMoreContrast(): boolean {
  return useSyncExternalStore(
    subscribeToSystemContrast,
    prefersMoreContrast,
    () => false
  )
}

/** The stored choice when there is one, else the system setting */
export function useHighContrast(): boolean {
  const choice = highContrastPreference.useValue()
  const systemPrefersMore = useSystemPrefersMoreContrast()
  return choice ?? systemPrefersMore
}

export interface HighContrastPreference {
  /** Whether the mode is on, chosen or from the system */
  isEnabled: boolean
  /** Remembers the choice, which then wins over the system */
  setEnabled: (isEnabled: boolean) => void
}

export function useHighContrastPreference(): HighContrastPreference {
  const isEnabled = useHighContrast()
  const setEnabled = useCallback((value: boolean) => {
    highContrastPreference.write(value)
  }, [])
  return { isEnabled, setEnabled }
}

/**
 * The focus indicator the user chose: the high-contrast mode turns the
 * enhanced one on as well
 */
export function useFocusIndicator(): FocusIndicator {
  const isEnhanced = accessibilityPreference.useValue()
  const isHighContrast = useHighContrast()
  return isEnhanced || isHighContrast ? 'enhanced' : 'discreet'
}
