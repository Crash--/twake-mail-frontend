import {
  formatFullDate,
  formatHeaderDate,
  formatListDate
} from './formatListDate'

const NOW = new Date('2026-10-04T15:00:00Z')

describe('formatListDate', () => {
  it('shows the time of the emails of the day, on the clock of the language', () => {
    expect(formatListDate('2026-10-04T08:05:00Z', 'en', NOW)).toBe('8:05 AM')
    expect(formatListDate('2026-10-04T13:05:00Z', 'en', NOW)).toBe('1:05 PM')
    expect(formatListDate('2026-10-04T08:05:00Z', 'fr', NOW)).toBe('8:05')
    expect(formatListDate('2026-10-04T13:05:00Z', 'fr', NOW)).toBe('13:05')
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

describe('formatHeaderDate', () => {
  it('shows the day, month and time, and the year when it is not this one', () => {
    expect(formatHeaderDate('2026-07-28T02:20:00Z', 'en', NOW)).toBe(
      'Jul 28, 2:20 AM'
    )
    expect(formatHeaderDate('2024-07-28T02:20:00Z', 'en', NOW)).toBe(
      'Jul 28, 2024, 2:20 AM'
    )
    expect(formatHeaderDate('not a date', 'en', NOW)).toBe('')
  })
})

describe('the formatters', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('builds one per language and format, not one per date', () => {
    const build = jest.spyOn(Intl, 'DateTimeFormat')
    const dates = Array.from(
      { length: 50 },
      (_, day) => `2026-09-${String((day % 28) + 1).padStart(2, '0')}T10:00:00Z`
    )

    for (const isoDate of dates) {
      formatListDate(isoDate, 'de', NOW)
      formatFullDate(isoDate, 'de')
      formatHeaderDate(isoDate, 'de', NOW)
    }

    // One for each of the 3 formats, and one to read the time zone
    expect(build).toHaveBeenCalledTimes(4)
  })

  it('follows a change of the time zone of the device', () => {
    jest.useFakeTimers({ now: NOW })
    const DateTimeFormat = Intl.DateTimeFormat
    let deviceZone = 'Europe/Paris'
    // The time zone of the device is the one of a formatter built bare
    jest
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation((locales, options) =>
        locales === undefined
          ? new DateTimeFormat(undefined, { timeZone: deviceZone })
          : new DateTimeFormat(locales, options)
      )
    const email = '2026-10-04T08:05:00Z'
    jest.advanceTimersByTime(1000)
    expect(formatListDate(email, 'en', NOW)).toBe('10:05 AM')
    expect(formatHeaderDate(email, 'en', NOW)).toBe('Oct 4, 10:05 AM')

    deviceZone = 'America/New_York'
    jest.advanceTimersByTime(1000)

    expect(formatListDate(email, 'en', NOW)).toBe('4:05 AM')
    expect(formatHeaderDate(email, 'en', NOW)).toBe('Oct 4, 4:05 AM')
    expect(formatFullDate(email, 'en')).toBe(
      'Sunday, October 4, 2026 at 4:05 AM'
    )
  })
})
