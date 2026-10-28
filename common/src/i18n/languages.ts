export type SupportedLanguage =
  'en' | 'fr' | 'ru' | 'vi' | 'it' | 'de' | 'mn' | 'es'

/** In the order of the language picker */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  'en',
  'fr',
  'ru',
  'vi',
  'it',
  'de',
  'mn',
  'es'
]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

/**
 * The name of each language in itself, as tmail-flutter lists them
 * (tmail-flutter has no Spanish in its picker)
 */
export const LANGUAGE_NATIVE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
  ru: 'Русский',
  vi: 'Tiếng Việt',
  it: 'Italiano',
  de: 'Deutsch',
  mn: 'Монгол',
  es: 'Español'
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
 * The languages the deployment offers (tmail-flutter `ALLOWED_LANGUAGES`):
 * comma-separated codes (`mn,en`), in their order, case and region ignored.
 * Unknown codes are skipped; none known (or unset) offers every language.
 */
export function parseAllowedLanguages(
  value: string | null
): readonly SupportedLanguage[] {
  const languages = (value ?? '')
    .split(',')
    .map(code => toSupportedLanguage(code.replace(/["']/g, '')))
    .filter(language => language !== null)
  const unique = [...new Set(languages)]
  return unique.length === 0 ? SUPPORTED_LANGUAGES : unique
}

/**
 * The supported language of a tag, when the deployment offers it
 */
export function toAllowedLanguage(
  tag: string | null | undefined,
  allowedLanguages: readonly SupportedLanguage[]
): SupportedLanguage | null {
  const language = toSupportedLanguage(tag)
  return language !== null && allowedLanguages.includes(language)
    ? language
    : null
}

/**
 * The first allowed language among the candidates, by order of preference,
 * else the default language when allowed, else the first allowed one (as
 * tmail-flutter).
 */
export function resolveLanguage(
  candidates: readonly (string | null | undefined)[],
  allowedLanguages: readonly SupportedLanguage[] = SUPPORTED_LANGUAGES
): SupportedLanguage {
  for (const candidate of candidates) {
    const language = toAllowedLanguage(candidate, allowedLanguages)
    if (language) return language
  }
  return allowedLanguages.includes(DEFAULT_LANGUAGE)
    ? DEFAULT_LANGUAGE
    : (allowedLanguages[0] ?? DEFAULT_LANGUAGE)
}

/**
 * The language of the UI: the one the user chose, then the one of the
 * deployment, then the one of the browser, among the allowed ones.
 */
export function findPreferredLanguage(
  configuredLanguage: string | null,
  allowedLanguages: readonly SupportedLanguage[] = SUPPORTED_LANGUAGES
): SupportedLanguage {
  return resolveLanguage(
    [readStoredLanguage(), configuredLanguage, ...navigator.languages],
    allowedLanguages
  )
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
