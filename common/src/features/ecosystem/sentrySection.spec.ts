import { isSafeEcosystemDsn, parseEcosystemSentry } from './sentrySection'

describe('parseEcosystemSentry', () => {
  it('reads the sentry section, with booleans written as strings', () => {
    expect(
      parseEcosystemSentry({
        'Twake Drive': 'https://drive.example.com',
        sentry: {
          enabled: 'true',
          dsn: ' https://key@sentry.example.com/1 ',
          environment: 'production',
          userOptInByDefault: false
        }
      })
    ).toEqual({
      enabled: true,
      dsn: 'https://key@sentry.example.com/1',
      environment: 'production',
      userOptInByDefault: false
    })
  })

  it('keeps what is missing or of the wrong type unknown', () => {
    expect(
      parseEcosystemSentry({
        sentry: { enabled: 1, dsn: 42, environment: ' ' }
      })
    ).toEqual({
      enabled: null,
      dsn: null,
      environment: null,
      userOptInByDefault: null
    })
  })

  it.each([null, 'text', [], {}, { sentry: 'on' }, { sentry: [] }])(
    'finds nothing in %j',
    document => {
      expect(parseEcosystemSentry(document)).toBeNull()
    }
  )
})

describe('isSafeEcosystemDsn', () => {
  it.each(['https://key@sentry.example.com/1', 'https://key@host/prefix/42'])(
    'accepts %s',
    dsn => {
      expect(isSafeEcosystemDsn(dsn)).toBe(true)
    }
  )

  it.each([
    'http://key@sentry.example.com/1',
    'https://sentry.example.com/1',
    'https://key:secret@sentry.example.com/1',
    'https://key@sentry.example.com/project',
    'javascript:alert(1)',
    'not a url'
  ])('refuses %s', dsn => {
    expect(isSafeEcosystemDsn(dsn)).toBe(false)
  })
})
