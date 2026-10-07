import { useCallback } from 'react'

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

/** The focus indicator the user chose */
export function useFocusIndicator(): FocusIndicator {
  return accessibilityPreference.useValue() ? 'enhanced' : 'discreet'
}
