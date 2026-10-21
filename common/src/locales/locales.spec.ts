import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import italian from './it.json'
import mn from './mn.json'
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
    ['vi', vi],
    ['it', italian],
    ['de', de],
    ['mn', mn],
    ['es', es]
  ])('%s has exactly the English keys', (_lang, dictionary) => {
    expect(collectKeys(dictionary).sort()).toEqual(englishKeys)
  })

  // The product name, in the titles and the name of the logo that shows it
  it.each([fr, ru, vi, italian, de, mn, es])(
    'keeps the product name untranslated',
    dictionary => {
      expect(dictionary.app.name).toBe('Twake Mail')
    }
  )
})
