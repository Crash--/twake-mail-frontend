import { isComposeIntent, parseComposeData } from './composeIntent'

describe('isComposeIntent', () => {
  it('matches CREATE io.cozy.mails, the action in any case', () => {
    expect(isComposeIntent('CREATE', 'io.cozy.mails')).toBe(true)
    expect(isComposeIntent('create', 'io.cozy.mails')).toBe(true)
    expect(isComposeIntent('OPEN', 'io.cozy.mails')).toBe(false)
    expect(isComposeIntent('CREATE', 'io.cozy.files')).toBe(false)
  })
})

describe('parseComposeData', () => {
  it('reads the fields of the new message', () => {
    expect(
      parseComposeData({
        to: ['bob@example.com', ' '],
        cc: ['carol@example.com'],
        subject: 'Hello',
        body: 'Hi Bob'
      })
    ).toEqual({
      to: ['bob@example.com'],
      cc: ['carol@example.com'],
      bcc: [],
      subject: 'Hello',
      body: 'Hi Bob'
    })
  })

  it('opens an empty message without data', () => {
    expect(parseComposeData(null)).toEqual({
      to: [],
      cc: [],
      bcc: [],
      subject: null,
      body: null
    })
    expect(parseComposeData({})).toEqual({
      to: [],
      cc: [],
      bcc: [],
      subject: null,
      body: null
    })
  })

  it('refuses data of another shape', () => {
    expect(parseComposeData('mailto:bob@example.com')).toBe(null)
    expect(parseComposeData(['bob@example.com'])).toBe(null)
    expect(parseComposeData({ to: 'bob@example.com' })).toBe(null)
    expect(parseComposeData({ to: [42] })).toBe(null)
    expect(parseComposeData({ subject: 42 })).toBe(null)
  })
})
