import { contactLinks } from './contactLinks'

const OPTIONS = {
  calendarSpaUrl: 'https://calendar.example.com',
  chatSpaUrl: 'https://chat.example.com/#/chat/@{target}',
  workplaceFqdnFallback: null,
  username: 'alice@example.com'
}

describe('contactLinks', () => {
  it('opens a new event with the contact invited', () => {
    expect(contactLinks('bob@example.com', OPTIONS).invite).toBe(
      'https://calendar.example.com/newEvent?attendee=bob%40example.com'
    )
  })

  it('opens a chat with the local part of the address', () => {
    expect(contactLinks('bob@example.com', OPTIONS).chat).toBe(
      'https://chat.example.com/#/chat/@bob'
    )
  })

  it('has no link where the integration is not configured', () => {
    expect(
      contactLinks('bob@example.com', {
        ...OPTIONS,
        calendarSpaUrl: null,
        chatSpaUrl: null
      })
    ).toEqual({ invite: null, chat: null })
  })

  it('resolves the templates of the user', () => {
    expect(
      contactLinks('bob@example.com', {
        ...OPTIONS,
        calendarSpaUrl: 'https://{localpart}.calendar.example.com'
      }).invite
    ).toBe(
      'https://alice.calendar.example.com/newEvent?attendee=bob%40example.com'
    )
  })

  it('refuses a template that is not a web link', () => {
    expect(
      contactLinks('bob@example.com', {
        ...OPTIONS,
        chatSpaUrl: 'javascript:alert({target})'
      }).chat
    ).toBe(null)
  })
})
