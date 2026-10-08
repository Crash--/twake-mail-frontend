import { useEffect, type ReactElement } from 'react'

import { useServerSettings } from './serverSettings'
import {
  DEFAULT_THEME,
  THEME_SETTING_KEY,
  toThemePreference,
  useThemePreference
} from './themePreference'

/**
 * Colours the app as the account says (`appearance.theme` of the server
 * settings) once read: light, dark, or as the system; light when the
 * account says nothing. The copy kept in this browser follows, for the
 * next load.
 */
export function ServerThemeSync(): ReactElement | null {
  const { settings, isRead } = useServerSettings()
  const { preference, setPreference } = useThemePreference()
  const serverTheme = isRead
    ? (toThemePreference(settings?.[THEME_SETTING_KEY]) ?? DEFAULT_THEME)
    : null

  useEffect(() => {
    if (serverTheme !== null && serverTheme !== preference) {
      setPreference(serverTheme)
    }
    // Only when the server says something new
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverTheme])

  return null
}
