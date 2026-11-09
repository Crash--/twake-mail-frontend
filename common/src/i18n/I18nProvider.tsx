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

import de from '@common/locales/de.json'
import en from '@common/locales/en.json'
import es from '@common/locales/es.json'
import fr from '@common/locales/fr.json'
import it from '@common/locales/it.json'
import mn from '@common/locales/mn.json'
import ru from '@common/locales/ru.json'
import vi from '@common/locales/vi.json'

import { hasDateFormats, loadDateFormats } from './dateFormats'
import {
  DEFAULT_LANGUAGE,
  storeLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage
} from './languages'

type Dictionary = typeof en

const DICTIONARIES: Record<SupportedLanguage, Dictionary> = {
  en,
  fr,
  ru,
  vi,
  it,
  de,
  mn,
  es
}

function findDictionary(lang: SupportedLanguage): Dictionary {
  return DICTIONARIES[lang]
}

export interface I18nProviderProps {
  /** The language to start with; the user may change it */
  lang: SupportedLanguage
  /** The languages the deployment offers (`ALLOWED_LANGUAGES`) */
  allowedLanguages?: readonly SupportedLanguage[]
  children: ReactNode
}

export interface LanguageApi {
  lang: SupportedLanguage
  /** Shows the app in `lang` and remembers it in this browser */
  setLanguage: (lang: SupportedLanguage) => void
  /** The languages the user may pick, in the order of the picker */
  allowedLanguages: readonly SupportedLanguage[]
}

const LanguageContext = createContext<LanguageApi | null>(null)

/**
 * Provides the translations of the language of the app (`lang` at first,
 * then the one the user picks, see `useLanguage`), falling back to English
 * for the keys a dictionary lacks, and keeps `<html lang>` in sync. A
 * language whose dates the browser cannot write is shown once their data is
 * loaded (nothing at first, the previous language on a change).
 */
export function I18nProvider({
  lang: initialLang,
  allowedLanguages = SUPPORTED_LANGUAGES,
  children
}: I18nProviderProps): ReactElement | null {
  const [lang, setLang] = useState(initialLang)
  const [givenLang, setGivenLang] = useState(initialLang)
  if (givenLang !== initialLang) {
    setGivenLang(initialLang)
    setLang(initialLang)
  }
  const [shownLang, setShownLang] = useState<SupportedLanguage | null>(() =>
    hasDateFormats(initialLang) ? initialLang : null
  )
  if (shownLang !== lang && hasDateFormats(lang)) setShownLang(lang)

  useEffect(() => {
    if (hasDateFormats(lang)) return
    let current = true
    loadDateFormats(lang).then(
      () => {
        if (current) setShownLang(lang)
      },
      (error: unknown) => {
        console.warn('[i18n] Cannot load the date formats', error)
        // The dates in English rather than the whole app
        if (current) setShownLang(lang)
      }
    )
    return () => {
      current = false
    }
  }, [lang])

  useEffect(() => {
    if (shownLang !== null) document.documentElement.lang = shownLang
  }, [shownLang])

  const api = useMemo(
    (): LanguageApi => ({
      lang: shownLang ?? lang,
      setLanguage: next => {
        storeLanguage(next)
        setLang(next)
      },
      allowedLanguages
    }),
    [lang, shownLang, allowedLanguages]
  )

  if (shownLang === null) return null
  return (
    <LanguageContext.Provider value={api}>
      <I18n
        lang={shownLang}
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
