import { formatSize } from './formatSize'

describe('formatSize', () => {
  it('picks the unit that keeps the number short', () => {
    expect(formatSize(512, 'en')).toBe('512 byte')
    expect(formatSize(12_345, 'en')).toBe('12.3 kB')
    expect(formatSize(3_400_000, 'fr')).toBe('3,4\u202fMo')
  })
})
