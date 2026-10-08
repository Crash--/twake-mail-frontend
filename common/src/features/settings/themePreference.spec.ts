import {
  THEME_PREFERENCE_STORAGE_KEY,
  themePreference,
  toThemePreference
} from './themePreference'

function makeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

describe('theme preference', () => {
  it('is light by default, and reads what it stored', () => {
    const storage = makeStorage()
    expect(themePreference.read(storage)).toBe('light')

    themePreference.write('dark', storage)
    expect(storage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark')
    expect(themePreference.read(storage)).toBe('dark')
  })

  it('is light on an unknown value', () => {
    const storage = makeStorage()
    storage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'blue')
    expect(themePreference.read(storage)).toBe('light')
  })

  it('only knows the values of the server setting', () => {
    expect(toThemePreference('light')).toBe('light')
    expect(toThemePreference('dark')).toBe('dark')
    expect(toThemePreference('system')).toBe('system')
    expect(toThemePreference('auto')).toBe(null)
    expect(toThemePreference(undefined)).toBe(null)
  })
})
