import { useI18n as useTwakeI18n } from 'twake-i18n'

import type en from '@common/locales/en.json'

type LeafPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : LeafPaths<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/** Every key of the English dictionary, the reference one */
export type TranslationKey = LeafPaths<typeof en>

/** Interpolation values, and `smart_count` to pick a plural form */
export type TranslationOptions = Record<string, string | number>

export interface I18nApi {
  t: (key: TranslationKey, options?: TranslationOptions) => string
  lang: string
}

/**
 * twake-i18n `useI18n`, with the translation keys of the application and
 * the interpolation options its own typings leave out.
 */
export function useI18n(): I18nApi {
  const { t, lang } = useTwakeI18n()
  return { t, lang }
}
