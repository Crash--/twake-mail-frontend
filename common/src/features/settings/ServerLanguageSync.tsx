import { useEffect, type ReactElement } from 'react'

import { useLanguage } from '@common/i18n/I18nProvider'
import { toSupportedLanguage } from '@common/i18n/languages'

import { useServerSettings } from './serverSettings'

/**
 * Shows the app in the language of the account (`language` of the server
 * settings) once known, as tmail-flutter does: the choice made on another
 * device wins over the one of this browser.
 */
export function ServerLanguageSync(): ReactElement | null {
  const { settings } = useServerSettings()
  const { lang, setLanguage } = useLanguage()
  const serverLanguage = toSupportedLanguage(settings?.language)

  useEffect(() => {
    if (serverLanguage !== null && serverLanguage !== lang) {
      setLanguage(serverLanguage)
    }
    // Only when the server says something new, not when the user picks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverLanguage])

  return null
}
