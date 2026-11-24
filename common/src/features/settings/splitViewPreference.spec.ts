import {
  SPLIT_VIEW_PREFERENCE_STORAGE_KEY,
  splitViewPreference
} from './splitViewPreference'

function makeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

describe('split view preference', () => {
  it('is off by default, and reads what it stored', () => {
    const storage = makeStorage()
    expect(splitViewPreference.read(storage)).toBe(false)

    splitViewPreference.write(true, storage)
    expect(storage.getItem(SPLIT_VIEW_PREFERENCE_STORAGE_KEY)).toBe('true')
    expect(splitViewPreference.read(storage)).toBe(true)

    splitViewPreference.write(false, storage)
    expect(splitViewPreference.read(storage)).toBe(false)
  })

  it('stays off on an unknown value', () => {
    const storage = makeStorage()
    storage.setItem(SPLIT_VIEW_PREFERENCE_STORAGE_KEY, 'yes')
    expect(splitViewPreference.read(storage)).toBe(false)
  })
})
