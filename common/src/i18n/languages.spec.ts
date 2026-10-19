import { resolveLanguage, toSupportedLanguage } from './languages'

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
})
