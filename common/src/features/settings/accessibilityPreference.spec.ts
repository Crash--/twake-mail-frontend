import {
  ACCESSIBILITY_PREFERENCE_STORAGE_KEY,
  accessibilityPreference,
  HIGH_CONTRAST_PREFERENCE_STORAGE_KEY,
  highContrastPreference
} from './accessibilityPreference'

function makeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

describe('accessibility preference', () => {
  it('is off by default, and reads what it stored', () => {
    const storage = makeStorage()
    expect(accessibilityPreference.read(storage)).toBe(false)

    accessibilityPreference.write(true, storage)
    expect(storage.getItem(ACCESSIBILITY_PREFERENCE_STORAGE_KEY)).toBe('true')
    expect(accessibilityPreference.read(storage)).toBe(true)
  })

  it('stays off on an unknown value', () => {
    const storage = makeStorage()
    storage.setItem(ACCESSIBILITY_PREFERENCE_STORAGE_KEY, 'yes')
    expect(accessibilityPreference.read(storage)).toBe(false)
  })
})

describe('high-contrast preference', () => {
  it('is null, the system deciding, until chosen', () => {
    const storage = makeStorage()
    expect(highContrastPreference.read(storage)).toBe(null)

    highContrastPreference.write(false, storage)
    expect(storage.getItem(HIGH_CONTRAST_PREFERENCE_STORAGE_KEY)).toBe('false')
    expect(highContrastPreference.read(storage)).toBe(false)

    highContrastPreference.write(true, storage)
    expect(highContrastPreference.read(storage)).toBe(true)
  })

  it('is null on an unknown value', () => {
    const storage = makeStorage()
    storage.setItem(HIGH_CONTRAST_PREFERENCE_STORAGE_KEY, 'yes')
    expect(highContrastPreference.read(storage)).toBe(null)
  })
})
