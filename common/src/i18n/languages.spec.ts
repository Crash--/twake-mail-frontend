import { resolveLanguage, toSupportedLanguage } from './languages'

describe('toSupportedLanguage', () => {
  it('keeps the primary subtag of a supported language', () => {
    expect(toSupportedLanguage('fr-FR')).toBe('fr')
    expect(toSupportedLanguage('RU')).toBe('ru')
  })

  it('returns null for an unsupported or missing language', () => {
    expect(toSupportedLanguage('de')).toBe(null)
    expect(toSupportedLanguage(null)).toBe(null)
  })
})

describe('resolveLanguage', () => {
  it('picks the first supported candidate', () => {
    expect(resolveLanguage([null, 'de-DE', 'vi-VN', 'fr'])).toBe('vi')
  })

  it('falls back to English', () => {
    expect(resolveLanguage(['de', undefined])).toBe('en')
  })
})
