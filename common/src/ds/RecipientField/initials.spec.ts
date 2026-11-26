import { initialsOf, splitMatches } from './initials'

describe('initialsOf', () => {
  it('takes the first letters of two words, or two letters of one, as tmail-flutter', () => {
    expect(initialsOf('Alice Martin')).toBe('AM')
    expect(initialsOf('alice@example.com')).toBe('AL')
    expect(initialsOf('Zoe 1')).toBe('ZZ')
    expect(initialsOf('x')).toBe('X')
  })

  it('takes letters of any script', () => {
    expect(initialsOf('Иван Петров')).toBe('ИП')
    expect(initialsOf('Élise Dupont')).toBe('ÉD')
  })

  it('keeps an accent and an emoji whole, composed or decomposed', () => {
    expect(initialsOf('Élise Dupont')).toBe('ÉD')
    expect(initialsOf('Élise Dupont')).toBe('ÉD')
    expect(initialsOf('🇫🇷')).toBe('🇫🇷')
    expect(initialsOf('1👍🏽')).toBe('1👍🏽')
  })

  it('splits the words on any white space', () => {
    expect(initialsOf('Alice  Martin')).toBe('AM')
    expect(initialsOf('Alice Martin')).toBe('AM')
    expect(initialsOf(' Alice Martin ')).toBe('AM')
  })
})

describe('splitMatches', () => {
  it('flags every occurrence of the query, whatever its case', () => {
    expect(splitMatches('alice@ALIce.com', 'ali')).toEqual([
      { text: 'ali', isMatch: true },
      { text: 'ce@', isMatch: false },
      { text: 'ALI', isMatch: true },
      { text: 'ce.com', isMatch: false }
    ])
    expect(splitMatches('Bob', '')).toEqual([{ text: 'Bob', isMatch: false }])
  })

  // "Zoé" written as "e" and a combining acute accent (NFD), as some
  // directories store it
  const DECOMPOSED = 'Zoé Martin'
  const COMPOSED = 'Zoé Martin'

  it('keeps an accent with its letter in a decomposed name', () => {
    expect(splitMatches(DECOMPOSED, 'zoe')).toEqual([
      { text: 'Zoé', isMatch: true },
      { text: ' Martin', isMatch: false }
    ])
    expect(splitMatches(DECOMPOSED, 'zo')).toEqual([
      { text: 'Zo', isMatch: true },
      { text: 'é Martin', isMatch: false }
    ])
  })

  it('matches whatever the accents and their encoding', () => {
    expect(splitMatches(COMPOSED, 'zoe')).toEqual([
      { text: 'Zoé', isMatch: true },
      { text: ' Martin', isMatch: false }
    ])
    expect(splitMatches(DECOMPOSED, 'Zoé m')).toEqual([
      { text: 'Zoé M', isMatch: true },
      { text: 'artin', isMatch: false }
    ])
    expect(splitMatches(COMPOSED, 'zoé')).toEqual([
      { text: 'Zoé', isMatch: true },
      { text: ' Martin', isMatch: false }
    ])
  })

  it('never starts a part with a lone accent', () => {
    for (const query of ['z', 'zo', 'zoe', 'e', 'mar', 'n']) {
      for (const part of splitMatches(DECOMPOSED, query)) {
        expect(part.text).not.toMatch(/^\p{M}/u)
      }
    }
  })
})
