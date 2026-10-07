import { formatSize } from './formatSize'

describe('formatSize', () => {
  it('picks the unit that keeps the number short', () => {
    expect(formatSize(512, 'en')).toBe('512 bytes')
    expect(formatSize(12_345, 'en')).toBe('12.3 kB')
    expect(formatSize(3_400_000, 'fr')).toBe('3,4\u202fMo')
  })

  it('spells bytes out with the plural of the language', () => {
    expect(formatSize(1, 'en')).toBe('1 byte')
    expect(formatSize(29, 'en')).toBe('29 bytes')
    expect(formatSize(29, 'fr')).toBe('29 octets')
  })
})
