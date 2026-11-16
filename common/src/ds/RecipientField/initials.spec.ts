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
})
