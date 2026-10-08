import type { KnownSettingKey } from 'jmap-client-ts/linagora'
import { useCallback } from 'react'

import { createLocalPreference } from './localPreference'

/**
 * The colour scheme of the app: light (the default), dark, or the one of
 * the system. The app offers no choice of its own: it is the
 * `appearance.theme` setting of the account (tmail-backend), copied in this
 * browser so that the next load starts with it (`ServerThemeSync`).
 */
export type ThemePreference = 'system' | 'light' | 'dark'

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
  return raw === 'system' || raw === 'light' || raw === 'dark' ? raw : null
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
