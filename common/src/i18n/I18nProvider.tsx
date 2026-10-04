import { useEffect, type ReactElement, type ReactNode } from 'react'
import { I18n } from 'twake-i18n'

import en from '@common/locales/en.json'
import fr from '@common/locales/fr.json'
import ru from '@common/locales/ru.json'
import vi from '@common/locales/vi.json'

import { DEFAULT_LANGUAGE, type SupportedLanguage } from './languages'

type Dictionary = typeof en

const DICTIONARIES: Record<SupportedLanguage, Dictionary> = { en, fr, ru, vi }

function findDictionary(lang: SupportedLanguage): Dictionary {
  return DICTIONARIES[lang]
}

export interface I18nProviderProps {
  lang: SupportedLanguage
  children: ReactNode
}

/**
 * Provides the translations of `lang`, falling back to English for the keys
 * a dictionary lacks, and keeps `<html lang>` in sync.
 */
export function I18nProvider({
  lang,
  children
}: I18nProviderProps): ReactElement {
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <I18n
      lang={lang}
      defaultLang={DEFAULT_LANGUAGE}
      dictRequire={findDictionary}
      polyglot={null}
      context={null}
    >
      {children}
    </I18n>
  )
}
