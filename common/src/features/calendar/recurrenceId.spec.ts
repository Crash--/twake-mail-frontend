import {
  formatOccurrenceStart,
  occurrenceStart,
  readRecurrenceId
} from './recurrenceId'

function ics(...lines: string[]): string {
  return ['BEGIN:VCALENDAR', ...lines, 'END:VCALENDAR'].join('\r\n')
}

describe('readRecurrenceId', () => {
  it('reads the recurrence id of the first event and its time zone', () => {
    expect(
      readRecurrenceId(
        ics(
          'BEGIN:VEVENT',
          'UID:a',
          'RECURRENCE-ID;TZID=Europe/Paris:20261103T090000',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'RECURRENCE-ID:20261110T080000Z',
          'END:VEVENT'
        )
      )
    ).toEqual({ value: '20261103T090000', timeZone: 'Europe/Paris' })
  })

  it('unfolds the lines and reads a quoted time zone', () => {
    expect(
      readRecurrenceId(
        ics(
          'BEGIN:VEVENT',
          'RECURRENCE-ID;VALUE=DATE-TIME;TZID="America/New',
          ' _York":20261103T090000',
          'END:VEVENT'
        )
      )
    ).toEqual({ value: '20261103T090000', timeZone: 'America/New_York' })
  })

  it('gives null for an event without one', () => {
    expect(
      readRecurrenceId(ics('BEGIN:VEVENT', 'RRULE:FREQ=WEEKLY', 'END:VEVENT'))
    ).toBe(null)
    // Not the one of a later event
    expect(
      readRecurrenceId(
        ics(
          'BEGIN:VEVENT',
          'UID:a',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'RECURRENCE-ID:20261110T080000Z',
          'END:VEVENT'
        )
      )
    ).toBe(null)
    expect(readRecurrenceId('not a calendar')).toBe(null)
  })
})

describe('occurrenceStart', () => {
  it('reads the date-time in its time zone, across a change of offset', () => {
    expect(
      occurrenceStart(
        { value: '20261103T090000', timeZone: 'Europe/Paris' },
        null
      )
    ).toEqual({ date: new Date('2026-11-03T08:00:00Z'), isAllDay: false })
    expect(
      occurrenceStart(
        { value: '20261020T090000', timeZone: 'Europe/Paris' },
        null
      )
    ).toEqual({ date: new Date('2026-10-20T07:00:00Z'), isAllDay: false })
  })

  it('uses the time zone of the event when the id has none', () => {
    expect(
      occurrenceStart(
        { value: '20261103T090000', timeZone: null },
        'Asia/Tokyo'
      )
    ).toEqual({ date: new Date('2026-11-03T00:00:00Z'), isAllDay: false })
  })

  it('reads UTC, floating times and whole days', () => {
    expect(
      occurrenceStart(
        { value: '20261103T090000Z', timeZone: null },
        'Asia/Tokyo'
      )
    ).toEqual({ date: new Date('2026-11-03T09:00:00Z'), isAllDay: false })
    // The tests run in UTC
    expect(
      occurrenceStart({ value: '20261103T090000', timeZone: null }, null)
    ).toEqual({ date: new Date('2026-11-03T09:00:00Z'), isAllDay: false })
    expect(
      occurrenceStart({ value: '20261103', timeZone: null }, 'Europe/Paris')
    ).toEqual({ date: new Date('2026-11-03T00:00:00Z'), isAllDay: true })
  })

  it('gives null for an unreadable value or time zone', () => {
    expect(occurrenceStart({ value: 'soon', timeZone: null }, null)).toBe(null)
    expect(
      occurrenceStart(
        { value: '20261103T090000', timeZone: 'Nowhere/Land' },
        null
      )
    ).toBe(null)
  })
})

describe('formatOccurrenceStart', () => {
  it('tells the date and the time, or the day alone', () => {
    const date = new Date('2026-11-03T08:00:00Z')
    expect(
      formatOccurrenceStart({ date, isAllDay: false }, 'en', 'Europe/Paris')
    ).toBe('Tuesday, November 3, 2026 at 9:00 AM')
    expect(
      formatOccurrenceStart(
        { date: new Date('2026-11-03T00:00:00Z'), isAllDay: true },
        'en',
        'Pacific/Honolulu'
      )
    ).toBe('Tuesday, November 3, 2026')
  })
})
