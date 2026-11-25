import { parseCalendarSenderMismatch } from './calendarSenderMismatch'

describe('parseCalendarSenderMismatch', () => {
  it('reads the organizer and the sender', () => {
    expect(
      parseCalendarSenderMismatch(
        'organizer=<boss@example.com>; sender=<intruder@example.org>'
      )
    ).toEqual({
      organizer: 'boss@example.com',
      sender: 'intruder@example.org'
    })
  })

  it('accepts the parameters in any order, any case, without brackets', () => {
    expect(
      parseCalendarSenderMismatch(
        ' Sender = intruder@example.org ;ORGANIZER=boss@example.com'
      )
    ).toEqual({
      organizer: 'boss@example.com',
      sender: 'intruder@example.org'
    })
  })

  it('has no organizer when it is missing or empty', () => {
    expect(
      parseCalendarSenderMismatch('sender=<intruder@example.org>')
    ).toEqual({ organizer: null, sender: 'intruder@example.org' })
    expect(
      parseCalendarSenderMismatch('organizer=<>; sender=<intruder@example.org>')
    ).toEqual({ organizer: null, sender: 'intruder@example.org' })
  })

  it('has no address without the header, or with unknown parameters', () => {
    const none = { organizer: null, sender: null }
    expect(parseCalendarSenderMismatch(null)).toEqual(none)
    expect(parseCalendarSenderMismatch(undefined)).toEqual(none)
    expect(parseCalendarSenderMismatch('garbage; foo=<bar>')).toEqual(none)
  })

  it('drops control characters and caps a long address', () => {
    const { organizer, sender } = parseCalendarSenderMismatch(
      `organizer=<boss\u0007@example.com>; sender=<${'x'.repeat(1000)}>`
    )
    expect(organizer).toBe('boss@example.com')
    expect(Array.from(sender ?? '')).toHaveLength(321)
  })
})
