import { formatFullDate, formatListDate } from './formatListDate'

const NOW = new Date('2026-10-04T15:00:00Z')

describe('formatListDate', () => {
  it('shows the time of the emails of the day', () => {
    expect(formatListDate('2026-10-04T08:05:00Z', 'en', NOW)).toBe('8:05 AM')
    expect(formatListDate('2026-10-04T08:05:00Z', 'fr', NOW)).toBe('8:05')
  })

  it('shows the weekday of the emails of yesterday', () => {
    expect(formatListDate('2026-10-03T22:00:00Z', 'en', NOW)).toBe('Sat')
    expect(formatListDate('2026-10-03T22:00:00Z', 'fr', NOW)).toBe('sam.')
  })

  it('shows the day and month of the emails of the year', () => {
    expect(formatListDate('2026-02-14T10:00:00Z', 'en', NOW)).toBe('Feb 14')
    expect(formatListDate('2026-02-14T10:00:00Z', 'fr', NOW)).toBe('14 févr.')
  })

  it('shows the full date of older emails', () => {
    expect(formatListDate('2024-12-31T10:00:00Z', 'en', NOW)).toBe(
      'Dec 31, 2024'
    )
  })

  it('shows nothing for an invalid date', () => {
    expect(formatListDate('not a date', 'en', NOW)).toBe('')
    expect(formatFullDate('not a date', 'en')).toBe('')
  })
})
