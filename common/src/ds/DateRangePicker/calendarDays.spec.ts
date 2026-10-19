import {
  addDays,
  addMonths,
  formatDayText,
  maskDayText,
  monthWeeks,
  parseDayText,
  weekdayOf
} from './calendarDays'

describe('calendarDays', () => {
  it('moves by days and months, on the last day of a shorter month', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-10-08', -12)).toBe('2025-10-08')
  })

  it('lays a month out in weeks from Monday', () => {
    // October 2026 starts on a Thursday and ends on a Saturday
    expect(weekdayOf('2026-10-01')).toBe(3)
    const weeks = monthWeeks('2026-10-01')
    expect(weeks).toHaveLength(5)
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04'
    ])
    expect(weeks[4]).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      null
    ])
  })

  it('writes and reads days as dd/mm/yyyy, refusing what is not a day', () => {
    expect(formatDayText('2026-10-08')).toBe('08/10/2026')
    expect(parseDayText('08/10/2026')).toBe('2026-10-08')
    expect(parseDayText('31/02/2026')).toBe(null)
    expect(parseDayText('8/10/2026')).toBe(null)
    expect(parseDayText('')).toBe(null)
  })

  it('puts the slashes in while a day is typed', () => {
    expect(maskDayText('0')).toBe('0')
    expect(maskDayText('081')).toBe('08/1')
    expect(maskDayText('08102026')).toBe('08/10/2026')
    expect(maskDayText('08/10/20261')).toBe('08/10/2026')
    expect(maskDayText('ab08')).toBe('08')
  })
})
