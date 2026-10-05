import {
  fetchEcosystemSentry,
  isSafeEcosystemDsn,
  parseEcosystemSentry
} from './ecosystem'

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

describe('fetchEcosystemSentry', () => {
  const fetchMock = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >()

  beforeEach(() => {
    globalThis.fetch = fetchMock
  })

  function answer(body: string, init: ResponseInit = { status: 200 }): void {
    fetchMock.mockResolvedValue(new Response(body, init))
  }

  it('asks without credentials, referrer nor cookies', async () => {
    answer('{"sentry":{"enabled":true}}')

    await fetchEcosystemSentry(
      'https://jmap.example.com/.well-known/linagora-ecosystem'
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://jmap.example.com/.well-known/linagora-ecosystem',
      expect.objectContaining({
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      })
    )
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.headers).toEqual({ Accept: 'application/json' })
  })

  it('reads the sentry section', async () => {
    answer('{"sentry":{"enabled":true,"userOptInByDefault":"true"}}')

    await expect(fetchEcosystemSentry('https://x/e')).resolves.toMatchObject({
      enabled: true,
      userOptInByDefault: true
    })
  })

  it.each([
    ['a missing document', '', { status: 404 }],
    ['a server error', '{}', { status: 500 }],
    ['text', 'not json', { status: 200 }],
    ['a huge document', ' '.repeat(70_000), { status: 200 }]
  ])('finds nothing in %s', async (_label, body, init) => {
    answer(body, init)

    await expect(fetchEcosystemSentry('https://x/e')).resolves.toBeNull()
  })
})
