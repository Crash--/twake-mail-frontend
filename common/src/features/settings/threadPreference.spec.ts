import { readThreadPreference, storeThreadPreference } from './threadPreference'

function makeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

describe('thread preference', () => {
  it('is on by default, and remembered once switched off', () => {
    const storage = makeStorage()
    expect(readThreadPreference(storage)).toBe(true)

    storeThreadPreference(false, storage)
    expect(readThreadPreference(storage)).toBe(false)

    storeThreadPreference(true, storage)
    expect(readThreadPreference(storage)).toBe(true)
  })
})
