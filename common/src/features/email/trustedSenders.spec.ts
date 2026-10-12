import {
  isSameDomain,
  readTrustedSenders,
  TRUSTED_SENDERS_STORAGE_KEY,
  trustSender
} from './trustedSenders'

function makeStorage(
  initial: Record<string, string> = {}
): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map(Object.entries(initial))
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    }
  }
}

describe('trustedSenders', () => {
  it('remembers a trusted sender, whatever its case', () => {
    const storage = makeStorage()

    trustSender(' Bob@Example.com ', storage)
    trustSender('alice@example.com', storage)

    expect(readTrustedSenders(storage)).toEqual(
      new Set(['bob@example.com', 'alice@example.com'])
    )
  })

  it('ignores a broken stored value', () => {
    const storage = makeStorage({ [TRUSTED_SENDERS_STORAGE_KEY]: '{not json' })

    expect(readTrustedSenders(storage)).toEqual(new Set())
  })

  it('works without storage', () => {
    expect(readTrustedSenders(null)).toEqual(new Set())
    expect(() => {
      trustSender('bob@example.com', null)
    }).not.toThrow()
  })
})

describe('isSameDomain', () => {
  it('trusts the addresses of the domain of the user, whatever the case', () => {
    expect(isSameDomain('Alice@Example.com', 'bob@example.com')).toBe(true)
    expect(isSameDomain('alice@other.org', 'bob@example.com')).toBe(false)
    expect(isSameDomain('no-domain', 'bob@example.com')).toBe(false)
  })
})
