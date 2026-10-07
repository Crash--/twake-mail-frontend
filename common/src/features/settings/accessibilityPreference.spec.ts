import {
  ACCESSIBILITY_PREFERENCE_STORAGE_KEY,
  accessibilityPreference
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
