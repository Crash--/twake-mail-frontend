import { calendarEventUrl } from './calendarUrl'

const OPTIONS = {
  calendarSpaUrl: 'https://calendar.example.com/',
  workplaceFqdnFallback: null,
  username: 'user@example.com'
}

describe('calendarEventUrl', () => {
  it('links the event under /events/', () => {
    expect(calendarEventUrl(' abc-123 ', OPTIONS)).toBe(
      'https://calendar.example.com/events/abc-123'
    )
  })

  it.each(['', '  ', '.', '..', ' . ', ' .. '])(
    'gives no link for the UID %j',
    uid => {
      expect(calendarEventUrl(uid, OPTIONS)).toBe(null)
    }
  )

  it.each(['a.b', '...', '.a', 'a..'])(
    'still links the UID %j, which is not a dot segment',
    uid => {
      expect(calendarEventUrl(uid, OPTIONS)).toBe(
        `https://calendar.example.com/events/${uid}`
      )
    }
  )

  it('gives no link without CALENDAR_SPA_URL', () => {
    expect(calendarEventUrl('abc', { ...OPTIONS, calendarSpaUrl: null })).toBe(
      null
    )
  })
})
