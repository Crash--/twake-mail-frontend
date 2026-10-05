import {
  eventTimes,
  formatDateBlock,
  formatEventDate,
  formatEventTime,
  type EventTimes
} from './formatEventTime'

function timesOf(utcStart: string, utcEnd: string): EventTimes {
  const times = eventTimes({ utcStart, utcEnd })
  if (times === null) throw new Error('No times')
  return times
}

/** `Intl` puts thin and narrow no-break spaces around the range dash */
function plain(text: string): string {
  return text.replace(/[\u2009\u202f]/g, ' ')
}

describe('formatEventTime', () => {
  it('writes a meeting in the time zone of the user, one date for one day', () => {
    const times = timesOf('2026-10-12T08:00:00Z', '2026-10-12T09:00:00Z')
    expect(times.isAllDay).toBe(false)
    expect(formatEventDate(times, 'en', 'Europe/Paris')).toBe(
      'Monday, October 12, 2026'
    )
    expect(plain(formatEventTime(times, 'en', 'Europe/Paris') ?? '')).toBe(
      '10:00 – 11:00 AM (GMT+2)'
    )
    expect(formatDateBlock(times, 'en', 'Europe/Paris')).toEqual({
      month: 'Oct',
      day: '12'
    })
  })

  it('writes whole days as dates, the last day included', () => {
    const times = timesOf('2026-10-12T00:00:00Z', '2026-10-14T00:00:00Z')
    expect(times.isAllDay).toBe(true)
    expect(plain(formatEventDate(times, 'en', 'America/New_York'))).toBe(
      'Monday, October 12 – Tuesday, October 13, 2026'
    )
    expect(formatEventTime(times, 'en', 'America/New_York')).toBe(null)
  })

  it('writes the dates and hours of a meeting across days', () => {
    const times = timesOf('2026-10-12T20:00:00Z', '2026-10-13T08:00:00Z')
    expect(plain(formatEventDate(times, 'en', 'Europe/Paris'))).toMatch(
      /^Monday, October 12, 2026 at 10:00 PM – Tuesday, October 13, 2026 at 10:00 AM$/
    )
    expect(formatEventTime(times, 'en', 'Europe/Paris')).toBe('GMT+2')
  })

  it('has no time without a start', () => {
    expect(eventTimes({ title: 'No date' })).toBe(null)
  })
})
