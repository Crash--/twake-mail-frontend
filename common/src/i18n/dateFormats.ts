import type { SupportedLanguage } from './languages'

// The CLDR data of the formatjs polyfill, one chunk per language
const LOCALE_DATA: Record<SupportedLanguage, () => Promise<unknown>> = {
  en: () => import('@formatjs/intl-datetimeformat/locale-data/en.js'),
  fr: () => import('@formatjs/intl-datetimeformat/locale-data/fr.js'),
  ru: () => import('@formatjs/intl-datetimeformat/locale-data/ru.js'),
  vi: () => import('@formatjs/intl-datetimeformat/locale-data/vi.js'),
  it: () => import('@formatjs/intl-datetimeformat/locale-data/it.js'),
  de: () => import('@formatjs/intl-datetimeformat/locale-data/de.js'),
  mn: () => import('@formatjs/intl-datetimeformat/locale-data/mn.js'),
  es: () => import('@formatjs/intl-datetimeformat/locale-data/es.js')
}

interface DateTimeFormatPolyfill {
  __setDefaultTimeZone: (timeZone: string) => void
}

function isPolyfill(
  dateTimeFormat: object
): dateTimeFormat is DateTimeFormatPolyfill {
  return '__setDefaultTimeZone' in dateTimeFormat
}

let polyfillLoading: Promise<void> | null = null

async function loadPolyfill(): Promise<void> {
  // The polyfill knows no time zone of its own and would show UTC
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  await import('@formatjs/intl-datetimeformat/polyfill-force.js')
  await import('@formatjs/intl-datetimeformat/add-all-tz.js')
  if (isPolyfill(Intl.DateTimeFormat)) {
    Intl.DateTimeFormat.__setDefaultTimeZone(timeZone)
  }
}

/** Whether the dates can be written in `lang` */
export function hasDateFormats(lang: SupportedLanguage): boolean {
  return Intl.DateTimeFormat.supportedLocalesOf([lang]).length > 0
}

/**
 * Makes the dates writable in `lang`. Some browsers lack the data of a
 * language (Chromium has no Mongolian) and fall back to English: the
 * formatjs polyfill then replaces `Intl.DateTimeFormat`, with the data of
 * each language as it is needed (tmail-flutter carries its own as well).
 */
export async function loadDateFormats(lang: SupportedLanguage): Promise<void> {
  if (hasDateFormats(lang)) return
  polyfillLoading ??= loadPolyfill().catch((error: unknown) => {
    polyfillLoading = null
    throw error
  })
  await polyfillLoading
  if (!hasDateFormats(lang)) await LOCALE_DATA[lang]()
}
