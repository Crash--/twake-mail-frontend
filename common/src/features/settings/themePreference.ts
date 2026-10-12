import type { KnownSettingKey } from 'jmap-client-ts/linagora'
import { useCallback } from 'react'

import { createLocalPreference } from './localPreference'

/**
 * The colour scheme of the app: light (the default), dark, or `auto`, the
 * one of the system. It is the `appearance.theme` setting of the account
 * (tmail-backend), chosen in Settings > Preferences when the server lets it
 * change, and copied in this browser so that the next load starts with it
 * (`ServerThemeSync`).
 */
export type ThemePreference = 'light' | 'dark' | 'auto'

/** The choices of Settings > Preferences, in their order */
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'light',
  'dark',
  'auto'
]

/** Without a setting of the account */
export const DEFAULT_THEME: ThemePreference = 'light'

/** The setting of the account that keeps the preference */
export const THEME_SETTING_KEY: KnownSettingKey = 'appearance.theme'

/**
 * The copy of the setting, also read by the inline script of
 * `public/index.html`, which colours the page before the app is loaded
 */
export const THEME_PREFERENCE_STORAGE_KEY = 'twake-mail.preferences.theme'

/** A stored or server value as a preference, null when it is none */
export function toThemePreference(
  raw: string | null | undefined
): ThemePreference | null {
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : null
}

export const themePreference = createLocalPreference<ThemePreference>({
  key: THEME_PREFERENCE_STORAGE_KEY,
  parse: raw => toThemePreference(raw) ?? DEFAULT_THEME,
  serialize: String
})

export interface ThemePreferenceApi {
  preference: ThemePreference
  /** Shows the app with `preference` and remembers it in this browser */
  setPreference: (preference: ThemePreference) => void
}

export function useThemePreference(): ThemePreferenceApi {
  const preference = themePreference.useValue()
  const setPreference = useCallback((value: ThemePreference) => {
    themePreference.write(value)
  }, [])
  return { preference, setPreference }
}
