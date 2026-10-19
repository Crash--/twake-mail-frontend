import {
  elapsedMs,
  randomTexts,
  STRESS_TIME_LIMIT_MS
} from '@common/testing/redos'

import {
  addressDisplayName,
  formatAddress,
  formatAddressName,
  formatAddressNames
} from './addresses'

const SPOOFED = { name: 'ceo@bank.com', email: 'x@evil.com' }

describe('addressDisplayName', () => {
  it('keeps a plain name, trimmed', () => {
    expect(
      addressDisplayName({ name: ' Bob ', email: 'bob@example.com' })
    ).toBe('Bob')
  })

  it('is empty without a name', () => {
    expect(addressDisplayName({ name: null, email: 'bob@example.com' })).toBe(
      ''
    )
  })

  it('drops a name holding another address', () => {
    expect(addressDisplayName(SPOOFED)).toBe('')
    expect(
      addressDisplayName({
        name: 'The CEO (ceo@bank.com)',
        email: 'x@evil.com'
      })
    ).toBe('')
  })

  it('keeps a name holding the real address, whatever its case', () => {
    expect(
      addressDisplayName({
        name: 'Bob <Bob@Example.com>',
        email: 'bob@example.com'
      })
    ).toBe('Bob <Bob@Example.com>')
  })

  it('keeps a name with an at sign that is no address', () => {
    expect(
      addressDisplayName({ name: 'Team @ Work', email: 'team@example.com' })
    ).toBe('Team @ Work')
  })
})

describe('formatAddressName', () => {
  it('shows the real address instead of a name holding another one', () => {
    expect(formatAddressName(SPOOFED)).toBe('x@evil.com')
  })
})

describe('formatAddress', () => {
  it('shows the name and the address', () => {
    expect(formatAddress({ name: 'Bob', email: 'bob@example.com' })).toBe(
      'Bob <bob@example.com>'
    )
  })

  it('shows the bare real address instead of a name holding another one', () => {
    expect(formatAddress(SPOOFED)).toBe('x@evil.com')
  })
})

describe('formatAddressNames', () => {
  it('shows the real address of a spoofing name in a list', () => {
    expect(
      formatAddressNames([{ name: 'Bob', email: 'bob@example.com' }, SPOOFED])
    ).toBe('Bob, x@evil.com')
  })
})

describe('addressDisplayName against ReDoS', () => {
  // The pattern the spoofing check used to run, quadratic on a failing name
  const ORIGINAL_ADDRESS_IN_NAME =
    /[^\s<>()[\]"',;:@]+@[^\s<>()[\]"',;:@]+\.[^\s<>()[\]"',;:@]+/g

  function originalDisplayName(name: string, email: string): string {
    const trimmed = name.trim()
    return Array.from(trimmed.matchAll(ORIGINAL_ADDRESS_IN_NAME)).some(
      ([found]) => found.toLowerCase() !== email.toLowerCase()
    )
      ? ''
      : trimmed
  }

  it('hides the names the original pattern hid', () => {
    const names = randomTexts(
      ['a', 'B', '.', '@', ' ', '<', '"', ',', 'x@y.z'],
      {
        count: 5000
      }
    )
    for (const name of names) {
      expect([name, addressDisplayName({ name, email: 'x@y.z' })]).toEqual([
        name,
        originalDisplayName(name, 'x@y.z')
      ])
    }
  })

  it.each([
    ['a name without domain', 'a'.repeat(50_000) + '.@.@...'],
    ['a name of at signs', 'a@'.repeat(25_000)],
    ['a name of dots', 'a.'.repeat(25_000) + '@b']
  ])('reads %s in a linear time', (_, name) => {
    expect(
      elapsedMs(() => addressDisplayName({ name, email: 'x@y.z' }))
    ).toBeLessThan(STRESS_TIME_LIMIT_MS)
  })
})
