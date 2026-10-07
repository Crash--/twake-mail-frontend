import { DEFAULT_SSO_SCOPE, resolveConfig } from './config'

const ORIGIN = 'https://mail.example.com'

const OIDC_SOURCE = {
  SERVER_URL: 'https://jmap.example.com',
  SSO_BASE_URL: 'https://sso.example.com',
  WEB_OIDC_CLIENT_ID: 'twake-mail'
}

/** The env.file of tmail-flutter, as the image turns it into .env.js */
const FLUTTER_ENV_FILE = {
  SERVER_URL: 'http://localhost/',
  DOMAIN_REDIRECT_URL: 'http://localhost:3000',
  WEB_OIDC_CLIENT_ID: 'teammail-web',
  OIDC_SCOPES: 'openid,profile,email,offline_access',
  APP_GRID_AVAILABLE: 'supported',
  FCM_AVAILABLE: 'supported',
  IOS_FCM: 'supported',
  FORWARD_WARNING_MESSAGE: '',
  PLATFORM: 'other',
  WS_ECHO_PING: '',
  COZY_INTEGRATION: '',
  COZY_EXTERNAL_BRIDGE_VERSION: '',
  SENTRY_ENABLED: 'false',
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: '',
  FORCE_EMAIL_QUERY: 'false'
}

function resolveWithWarnings(source: Record<string, unknown>): {
  result: ReturnType<typeof resolveConfig>
  warnings: string[]
} {
  const warnings: string[] = []
  const result = resolveConfig(source, ORIGIN, message =>
    warnings.push(message)
  )
  return { result, warnings }
}

describe('resolveConfig', () => {
  it('defaults to OIDC with the redirect URIs of the origin', () => {
    const result = resolveConfig(OIDC_SOURCE, ORIGIN)

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        jmapSessionUrl: 'https://jmap.example.com/.well-known/jmap',
        authMode: 'oidc',
        oidc: {
          issuerUrl: 'https://sso.example.com',
          clientId: 'twake-mail',
          scope: DEFAULT_SSO_SCOPE,
          redirectUri: 'https://mail.example.com/callback',
          postLogoutRedirectUri: 'https://mail.example.com/'
        },
        debug: false,
        sentrySource: 'ecosystem',
        sentryDsn: null,
        sentryEnvironment: null,
        sentryFeedbackEnabled: false,
        forwardWarningMessage: null,
        workplaceEmbedding: false,
        tdriveIntentUrl: null,
        cozyStackUrl: 'https://{workplaceFqdn}',
        appVersion: 'dev'
      })
    })
  })

  it('reads the forwarding warning, without its surrounding spaces', () => {
    const result = resolveConfig(
      { ...OIDC_SOURCE, FORWARD_WARNING_MESSAGE: '  No external forward.  ' },
      ORIGIN
    )

    expect(result.ok && result.value.forwardWarningMessage).toBe(
      'No external forward.'
    )
  })

  it('reads the Drive picker only when TDRIVE_ENABLED is on', () => {
    const drive = { TDRIVE_INTENT_URL: 'https://{localpart}.twake.example.com' }

    expect(resolveConfig({ ...OIDC_SOURCE, ...drive }, ORIGIN)).toMatchObject({
      value: { tdriveIntentUrl: null }
    })
    expect(
      resolveConfig({ ...OIDC_SOURCE, ...drive, TDRIVE_ENABLED: true }, ORIGIN)
    ).toMatchObject({
      value: { tdriveIntentUrl: 'https://{localpart}.twake.example.com' }
    })
  })

  it('reads the cozy-stack of the intents even when TDRIVE_ENABLED is off', () => {
    expect(
      resolveConfig(
        {
          ...OIDC_SOURCE,
          TDRIVE_INTENT_URL: 'https://{localpart}.example.com'
        },
        ORIGIN
      )
    ).toMatchObject({
      value: { cozyStackUrl: 'https://{localpart}.example.com' }
    })
  })

  it('accepts the basic mode without any SSO setting', () => {
    const result = resolveConfig(
      {
        SERVER_URL: 'http://localhost/',
        AUTH_MODE: 'basic'
      },
      ORIGIN
    )

    expect(result.ok && result.value.authMode).toBe('basic')
    expect(result.ok && result.value.oidc).toBe(null)
  })

  it('reports every missing required entry at once', () => {
    const result = resolveConfig({ WEB_OIDC_CLIENT_ID: '  ' }, ORIGIN)

    expect(result).toEqual({
      ok: false,
      errors: [
        'SERVER_URL must be an absolute http(s) URL',
        'SSO_BASE_URL must be an absolute http(s) URL',
        'WEB_OIDC_CLIENT_ID is required'
      ]
    })
  })

  it('rejects an unknown authentication mode', () => {
    const result = resolveConfig(
      { ...OIDC_SOURCE, AUTH_MODE: 'kerberos' },
      ORIGIN
    )

    expect(result).toEqual({
      ok: false,
      errors: ['AUTH_MODE must be one of: oidc, basic']
    })
  })

  it('reads DEBUG written as a string', () => {
    const result = resolveConfig({ ...OIDC_SOURCE, DEBUG: 'true' }, ORIGIN)

    expect(result.ok && result.value.debug).toBe(true)
  })

  describe('SERVER_URL', () => {
    it.each([
      ['http://localhost/', 'http://localhost/.well-known/jmap'],
      ['http://localhost', 'http://localhost/.well-known/jmap'],
      [
        'https://mail.example.com/api',
        'https://mail.example.com/api/.well-known/jmap'
      ],
      [
        'https://mail.example.com/api//',
        'https://mail.example.com/api/.well-known/jmap'
      ]
    ])('derives the JMAP session URL of %s', (serverUrl, sessionUrl) => {
      const { result, warnings } = resolveWithWarnings({
        ...OIDC_SOURCE,
        SERVER_URL: serverUrl
      })

      expect(result.ok && result.value.jmapSessionUrl).toBe(sessionUrl)
      expect(warnings).toEqual([])
    })

    it('rejects a server URL that is not absolute', () => {
      const { result } = resolveWithWarnings({
        ...OIDC_SOURCE,
        SERVER_URL: 'jmap'
      })

      expect(result).toEqual({
        ok: false,
        errors: ['SERVER_URL must be an absolute http(s) URL']
      })
    })
  })

  describe('OIDC keys of tmail-flutter', () => {
    it('builds the redirect URIs from DOMAIN_REDIRECT_URL, as tmail-flutter', () => {
      const { result } = resolveWithWarnings({
        ...OIDC_SOURCE,
        DOMAIN_REDIRECT_URL: 'https://mail.example.com/app/'
      })

      expect(result.ok && result.value.oidc).toMatchObject({
        redirectUri: 'https://mail.example.com/app/login-callback.html',
        postLogoutRedirectUri:
          'https://mail.example.com/app/logout-callback.html'
      })
    })

    it('lets SSO_REDIRECT_URI and SSO_POST_LOGOUT_REDIRECT override them', () => {
      const { result } = resolveWithWarnings({
        ...OIDC_SOURCE,
        DOMAIN_REDIRECT_URL: 'https://mail.example.com',
        SSO_REDIRECT_URI: 'https://mail.example.com/callback',
        SSO_POST_LOGOUT_REDIRECT: 'https://mail.example.com/bye'
      })

      expect(result.ok && result.value.oidc).toMatchObject({
        redirectUri: 'https://mail.example.com/callback',
        postLogoutRedirectUri: 'https://mail.example.com/bye'
      })
    })

    it('rejects a DOMAIN_REDIRECT_URL that is not absolute', () => {
      const { result } = resolveWithWarnings({
        ...OIDC_SOURCE,
        DOMAIN_REDIRECT_URL: 'mail.example.com'
      })

      expect(result).toEqual({
        ok: false,
        errors: [
          'DOMAIN_REDIRECT_URL (or SSO_REDIRECT_URI) must be an absolute http(s) URL',
          'DOMAIN_REDIRECT_URL (or SSO_POST_LOGOUT_REDIRECT) must be an absolute http(s) URL'
        ]
      })
    })

    it.each([
      [
        'openid,profile,email,offline_access',
        'openid profile email offline_access'
      ],
      ['openid, profile ,email,', 'openid profile email'],
      ['openid profile', 'openid profile'],
      [' ,, ', DEFAULT_SSO_SCOPE],
      ['', DEFAULT_SSO_SCOPE]
    ])('reads OIDC_SCOPES %j as the scope %j', (scopes, scope) => {
      const { result } = resolveWithWarnings({
        ...OIDC_SOURCE,
        OIDC_SCOPES: scopes
      })

      expect(result.ok && result.value.oidc?.scope).toBe(scope)
    })
  })

  describe('deprecated keys', () => {
    it('reads the former names, with one warning per key', () => {
      const { result, warnings } = resolveWithWarnings({
        JMAP_SESSION_URL: 'https://jmap.example.com/jmap/session',
        SSO_BASE_URL: 'https://sso.example.com',
        SSO_CLIENT_ID: 'old-client',
        SSO_SCOPE: 'openid profile'
      })

      expect(result).toMatchObject({
        ok: true,
        value: {
          jmapSessionUrl: 'https://jmap.example.com/jmap/session',
          oidc: { clientId: 'old-client', scope: 'openid profile' }
        }
      })
      expect(warnings).toEqual([
        'JMAP_SESSION_URL is deprecated, use SERVER_URL (the base URL of the JMAP server) instead',
        'SSO_CLIENT_ID is deprecated, use WEB_OIDC_CLIENT_ID instead',
        'SSO_SCOPE is deprecated, use OIDC_SCOPES instead'
      ])
    })

    it('prefers the names of tmail-flutter and stays silent', () => {
      const { result, warnings } = resolveWithWarnings({
        ...OIDC_SOURCE,
        OIDC_SCOPES: 'openid,email',
        JMAP_SESSION_URL: 'https://old.example.com/jmap/session',
        SSO_CLIENT_ID: 'old-client',
        SSO_SCOPE: 'openid'
      })

      expect(result).toMatchObject({
        ok: true,
        value: {
          jmapSessionUrl: 'https://jmap.example.com/.well-known/jmap',
          oidc: { clientId: 'twake-mail', scope: 'openid email' }
        }
      })
      expect(warnings).toEqual([])
    })
  })

  describe('Sentry', () => {
    const SENTRY = {
      SENTRY_DSN: 'https://key@sentry.example.com/1',
      SENTRY_ENVIRONMENT: 'production'
    }

    it.each([true, 'true'])('starts with SENTRY_ENABLED %j', enabled => {
      const { result, warnings } = resolveWithWarnings({
        ...OIDC_SOURCE,
        ...SENTRY,
        SENTRY_ENABLED: enabled
      })

      expect(result).toMatchObject({
        value: {
          sentryDsn: 'https://key@sentry.example.com/1',
          sentryEnvironment: 'production'
        }
      })
      expect(warnings).toEqual([])
    })

    it.each([false, 'false', '', 'yes'])(
      'stays off with SENTRY_ENABLED %j, whatever the DSN',
      enabled => {
        const { result } = resolveWithWarnings({
          ...OIDC_SOURCE,
          ...SENTRY,
          SENTRY_ENABLED: enabled
        })

        expect(result).toMatchObject({
          value: { sentryDsn: null, sentryEnvironment: null }
        })
      }
    )

    it('comes from the ecosystem of the server when no key is filled', () => {
      const { result } = resolveWithWarnings({
        ...OIDC_SOURCE,
        SENTRY_ENABLED: '',
        SENTRY_DSN: '  ',
        SENTRY_ENVIRONMENT: ''
      })

      expect(result).toMatchObject({
        value: {
          sentrySource: 'ecosystem',
          sentryDsn: null,
          sentryEnvironment: null,
          ecosystemUrl:
            'https://jmap.example.com/.well-known/linagora-ecosystem'
        }
      })
    })

    it.each([
      ['SENTRY_ENABLED', false],
      ['SENTRY_ENABLED', 'false'],
      ['SENTRY_DSN', 'https://key@sentry.example.com/1'],
      ['SENTRY_ENVIRONMENT', 'production']
    ])(
      'comes from the environment, with no ecosystem, once %s is %j',
      (key, value) => {
        const { result } = resolveWithWarnings({
          ...OIDC_SOURCE,
          [key]: value
        })

        expect(result).toMatchObject({ value: { sentrySource: 'env' } })
      }
    )

    it.each([
      [true, true],
      ['true', true],
      [false, false],
      ['false', false],
      ['', false],
      ['yes', false],
      [undefined, false]
    ])('reads SENTRY_FEEDBACK_ENABLED %j as %j', (value, expected) => {
      const { result } = resolveWithWarnings({
        ...OIDC_SOURCE,
        ...SENTRY,
        SENTRY_ENABLED: 'true',
        SENTRY_FEEDBACK_ENABLED: value
      })

      expect(result).toMatchObject({
        value: { sentryFeedbackEnabled: expected }
      })
    })

    it('leaves the source to the ecosystem when only the feedback flag is set', () => {
      const { result, warnings } = resolveWithWarnings({
        ...OIDC_SOURCE,
        SENTRY_ENABLED: '',
        SENTRY_DSN: '',
        SENTRY_ENVIRONMENT: '',
        SENTRY_FEEDBACK_ENABLED: 'true'
      })

      expect(result).toMatchObject({
        value: { sentrySource: 'ecosystem', sentryFeedbackEnabled: true }
      })
      expect(warnings).toEqual([])
    })

    it('keeps the path of SERVER_URL for the ecosystem document', () => {
      const { result } = resolveWithWarnings({
        ...OIDC_SOURCE,
        SERVER_URL: 'https://example.com/jmap-base/'
      })

      expect(result).toMatchObject({
        value: {
          ecosystemUrl:
            'https://example.com/jmap-base/.well-known/linagora-ecosystem'
        }
      })
    })

    it('still starts with a DSN alone, with a warning', () => {
      const { result, warnings } = resolveWithWarnings({
        ...OIDC_SOURCE,
        SENTRY_DSN: SENTRY.SENTRY_DSN,
        SENTRY_ENVIRONMENT: SENTRY.SENTRY_ENVIRONMENT
      })

      expect(result).toMatchObject({
        value: { sentryDsn: SENTRY.SENTRY_DSN, sentryEnvironment: 'production' }
      })
      expect(warnings).toEqual([
        'SENTRY_DSN without SENTRY_ENABLED is deprecated, set SENTRY_ENABLED=true'
      ])
    })
  })

  describe('the SSO of the server', () => {
    const NO_SSO_SOURCE = {
      SERVER_URL: 'https://jmap.example.com/',
      WEB_OIDC_CLIENT_ID: 'teammail-web'
    }

    it('is to be discovered, with the Basic form as fallback, without SSO_BASE_URL', () => {
      const { result } = resolveWithWarnings(NO_SSO_SOURCE)

      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          authMode: 'oidc',
          oidc: expect.objectContaining({
            issuerUrl: 'https://jmap.example.com'
          }),
          issuerDiscovery: {
            serverUrl: 'https://jmap.example.com',
            fallbackToBasic: true
          }
        })
      })
    })

    it('is required when AUTH_MODE=oidc is explicit', () => {
      const { result } = resolveWithWarnings({
        ...NO_SSO_SOURCE,
        AUTH_MODE: 'oidc'
      })

      expect(result.ok && result.value.issuerDiscovery).toEqual({
        serverUrl: 'https://jmap.example.com',
        fallbackToBasic: false
      })
    })

    it.each([
      [{ ...NO_SSO_SOURCE, SSO_BASE_URL: 'https://sso.example.com' }],
      [{ ...NO_SSO_SOURCE, AUTH_MODE: 'basic' }]
    ])('is not discovered with %j', source => {
      const { result } = resolveWithWarnings(source)

      expect(result.ok && result.value.issuerDiscovery).toBe(null)
    })
  })

  describe('Twake Workplace embedding', () => {
    it.each([
      [{ WORKPLACE_EMBEDDING: 'true' }, true],
      [{ COZY_INTEGRATION: 'true' }, true],
      [{ COZY_INTEGRATION: true }, true],
      [{ COZY_INTEGRATION: 'false' }, false],
      [{}, false]
    ])('with %j: %s', (extra, expected) => {
      const { result } = resolveWithWarnings({ ...OIDC_SOURCE, ...extra })

      expect(result.ok && result.value.workplaceEmbedding).toBe(expected)
    })
  })

  describe('an env.file of tmail-flutter', () => {
    it('is accepted as is, the keys of the mobile app ignored', () => {
      const { result, warnings } = resolveWithWarnings({
        ...FLUTTER_ENV_FILE,
        SSO_BASE_URL: 'https://sso.example.com'
      })

      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          jmapSessionUrl: 'http://localhost/.well-known/jmap',
          authMode: 'oidc',
          oidc: {
            issuerUrl: 'https://sso.example.com',
            clientId: 'teammail-web',
            scope: 'openid profile email offline_access',
            redirectUri: 'http://localhost:3000/login-callback.html',
            postLogoutRedirectUri: 'http://localhost:3000/logout-callback.html'
          },
          sentryDsn: null,
          forwardWarningMessage: null,
          debug: false
        })
      })
      expect(warnings).toEqual([])
    })
  })
})
