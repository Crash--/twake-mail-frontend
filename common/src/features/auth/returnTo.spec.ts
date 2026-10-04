import { sanitizeReturnTo } from './returnTo'

describe('sanitizeReturnTo', () => {
  it('keeps an in-app path with its query and fragment', () => {
    expect(sanitizeReturnTo('/mailbox/inbox?page=2#top')).toBe(
      '/mailbox/inbox?page=2#top'
    )
  })

  it.each([
    'https://evil.example.com/',
    '//evil.example.com/',
    '/\\evil.example.com',
    'mailbox',
    '/callback?code=abc',
    '/login',
    42
  ])('falls back to / for %p', value => {
    expect(sanitizeReturnTo(value)).toBe('/')
  })
})
