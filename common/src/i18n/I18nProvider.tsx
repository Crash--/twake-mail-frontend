import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { I18n } from 'twake-i18n'

import en from '@common/locales/en.json'
import fr from '@common/locales/fr.json'
import ru from '@common/locales/ru.json'
import vi from '@common/locales/vi.json'

import {
  DEFAULT_LANGUAGE,
  storeLanguage,
  type SupportedLanguage
} from './languages'

type Dictionary = typeof en

const DICTIONARIES: Record<SupportedLanguage, Dictionary> = { en, fr, ru, vi }

function findDictionary(lang: SupportedLanguage): Dictionary {
  return DICTIONARIES[lang]
}

export interface I18nProviderProps {
  /** The language to start with; the user may change it */
  lang: SupportedLanguage
  children: ReactNode
}

export interface LanguageApi {
  lang: SupportedLanguage
  /** Shows the app in `lang` and remembers it in this browser */
  setLanguage: (lang: SupportedLanguage) => void
}

const LanguageContext = createContext<LanguageApi | null>(null)

/**
 * Provides the translations of the language of the app (`lang` at first,
 * then the one the user picks, see `useLanguage`), falling back to English
 * for the keys a dictionary lacks, and keeps `<html lang>` in sync.
 */
export function I18nProvider({
  lang: initialLang,
  children
}: I18nProviderProps): ReactElement {
  const [lang, setLang] = useState(initialLang)
  const [givenLang, setGivenLang] = useState(initialLang)
  if (givenLang !== initialLang) {
    setGivenLang(initialLang)
    setLang(initialLang)
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const api = useMemo(
    (): LanguageApi => ({
      lang,
      setLanguage: next => {
        storeLanguage(next)
        setLang(next)
      }
    }),
    [lang]
  )

  return (
    <LanguageContext.Provider value={api}>
      <I18n
        lang={lang}
        defaultLang={DEFAULT_LANGUAGE}
        dictRequire={findDictionary}
        polyglot={null}
        context={null}
      >
        {children}
      </I18n>
    </LanguageContext.Provider>
  )
}

/** The language of the app and how to change it */
export function useLanguage(): LanguageApi {
  const api = useContext(LanguageContext)
  if (!api) throw new Error('useLanguage needs an I18nProvider')
  return api
}
