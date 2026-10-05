export type SupportedLanguage = 'en' | 'fr' | 'ru' | 'vi'

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  'en',
  'fr',
  'ru',
  'vi'
]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

/** The name of each language in itself, as tmail-flutter lists them */
export const LANGUAGE_NATIVE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
  ru: 'Русский',
  vi: 'Tiếng Việt'
}

/** Also read by the chunk-load fallback of public/index.html */
export const LANGUAGE_STORAGE_KEY = 'lang'

/**
 * Maps a language tag (`fr`, `fr-FR`, `FR`) to a supported language.
 */
export function toSupportedLanguage(
  tag: string | null | undefined
): SupportedLanguage | null {
  if (!tag) return null
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? ''
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(primary)
    ? (primary as SupportedLanguage) // SAFETY: membership checked above
    : null
}

/**
 * The first supported language among the candidates, by order of
 * preference, or the default language.
 */
export function resolveLanguage(
  candidates: readonly (string | null | undefined)[]
): SupportedLanguage {
  for (const candidate of candidates) {
    const language = toSupportedLanguage(candidate)
    if (language) return language
  }
  return DEFAULT_LANGUAGE
}

/**
 * The language of the UI: the one the user chose, then the one of the
 * deployment, then the one of the browser.
 */
export function findPreferredLanguage(
  configuredLanguage: string | null
): SupportedLanguage {
  return resolveLanguage([
    readStoredLanguage(),
    configuredLanguage,
    ...navigator.languages
  ])
}

/** Remembers the language chosen in this browser */
export function storeLanguage(lang: SupportedLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch (error: unknown) {
    // Storage can be disabled by the browser privacy settings
    console.warn('[i18n] Cannot remember the language', error)
  }
}

function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // Storage can be disabled by the browser privacy settings
    return null
  }
}
