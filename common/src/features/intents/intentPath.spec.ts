import {
  intentsRedirectUri,
  isIntentsCallbackPath,
  isUnderIntentsPath,
  parseIntentPath
} from './intentPath'

describe('parseIntentPath', () => {
  it('reads the intent id of the intents page', () => {
    expect(parseIntentPath('/intents?intent=abc-123_X')).toBe('abc-123_X')
    expect(parseIntentPath('/Intents/?intent=abc')).toBe('abc')
  })

  it('keeps the id when the page has other parameters', () => {
    expect(parseIntentPath('/intents?intent=abc&lang=fr')).toBe('abc')
  })

  it('refuses another path, a missing id, or an id that is no stack id', () => {
    expect(parseIntentPath('/mailto?intent=abc')).toBe(null)
    expect(parseIntentPath('/intents')).toBe(null)
    expect(parseIntentPath('/intents?intent=../settings')).toBe(null)
    expect(parseIntentPath('/intents?intent=a%3Bb')).toBe(null)
  })
})

describe('the paths of the intents page', () => {
  it('holds every path under /intents, never another one', () => {
    expect(isUnderIntentsPath('/intents')).toBe(true)
    expect(isUnderIntentsPath('/Intents/callback')).toBe(true)
    expect(isUnderIntentsPath('/intents/settings')).toBe(true)
    expect(isUnderIntentsPath('/intentsX')).toBe(false)
    expect(isUnderIntentsPath('/mailbox/intents')).toBe(false)
  })

  it('has its own login callback, on the origin of the app', () => {
    expect(isIntentsCallbackPath('/intents/callback')).toBe(true)
    expect(isIntentsCallbackPath('/intents/callback/')).toBe(true)
    expect(isIntentsCallbackPath('/callback')).toBe(false)
    expect(intentsRedirectUri('https://mail.example.com/callback')).toBe(
      'https://mail.example.com/intents/callback'
    )
    expect(
      intentsRedirectUri('https://mail.example.com/login-callback.html')
    ).toBe('https://mail.example.com/intents/callback')
  })
})
