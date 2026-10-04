import en from './en.json'
import fr from './fr.json'
import ru from './ru.json'
import vi from './vi.json'

interface Dictionary {
  [key: string]: string | Dictionary
}

function collectKeys(dictionary: Dictionary, prefix = ''): string[] {
  return Object.entries(dictionary).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [`${prefix}${key}`]
      : collectKeys(value, `${prefix}${key}.`)
  )
}

describe('locales', () => {
  const englishKeys = collectKeys(en).sort()

  it.each([
    ['fr', fr],
    ['ru', ru],
    ['vi', vi]
  ])('%s has exactly the English keys', (_lang, dictionary) => {
    expect(collectKeys(dictionary).sort()).toEqual(englishKeys)
  })
})
