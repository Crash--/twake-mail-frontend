import {
  parseAllowedLanguages,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  toAllowedLanguage,
  toSupportedLanguage
} from './languages'

describe('toSupportedLanguage', () => {
  it('keeps the primary subtag of a supported language', () => {
    expect(toSupportedLanguage('fr-FR')).toBe('fr')
    expect(toSupportedLanguage('RU')).toBe('ru')
    expect(toSupportedLanguage('mn-MN')).toBe('mn')
    expect(toSupportedLanguage('es_ES')).toBe('es')
  })

  it('returns null for an unsupported or missing language', () => {
    // Arabic waits for the right-to-left layout (#62)
    expect(toSupportedLanguage('ar')).toBe(null)
    expect(toSupportedLanguage(null)).toBe(null)
  })
})

describe('resolveLanguage', () => {
  it('picks the first supported candidate', () => {
    expect(resolveLanguage([null, 'ar-TN', 'it-IT', 'fr'])).toBe('it')
  })

  it('falls back to English', () => {
    expect(resolveLanguage(['ar', undefined])).toBe('en')
  })

  it('skips the languages the deployment does not offer', () => {
    expect(resolveLanguage(['fr', 'mn-MN', 'en'], ['en', 'mn'])).toBe('mn')
  })

  it('falls back to English when allowed, else to the first allowed', () => {
    expect(resolveLanguage(['fr'], ['mn', 'en'])).toBe('en')
    expect(resolveLanguage(['fr'], ['mn', 'de'])).toBe('mn')
  })
})

describe('parseAllowedLanguages', () => {
  it('keeps the listed languages in their order, case and region ignored', () => {
    expect(parseAllowedLanguages('MN, en-US,"fr_FR"')).toEqual([
      'mn',
      'en',
      'fr'
    ])
  })

  it('skips the unknown and repeated codes', () => {
    expect(parseAllowedLanguages('xx,mn,mn,ar')).toEqual(['mn'])
  })

  it('offers every language when unset, blank or without a known code', () => {
    expect(parseAllowedLanguages(null)).toBe(SUPPORTED_LANGUAGES)
    expect(parseAllowedLanguages(' , ')).toBe(SUPPORTED_LANGUAGES)
    expect(parseAllowedLanguages('xx,ar')).toBe(SUPPORTED_LANGUAGES)
  })
})

describe('toAllowedLanguage', () => {
  it('returns null for a supported language the deployment does not offer', () => {
    expect(toAllowedLanguage('fr', ['mn', 'en'])).toBe(null)
    expect(toAllowedLanguage('en-GB', ['mn', 'en'])).toBe('en')
  })
})
