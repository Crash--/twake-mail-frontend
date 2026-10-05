import { DEFAULT_SSO_SCOPE, resolveConfig } from './config'

const ORIGIN = 'https://mail.example.com'

const OIDC_SOURCE = {
  JMAP_SESSION_URL: 'https://jmap.example.com/jmap/session',
  SSO_BASE_URL: 'https://sso.example.com',
  SSO_CLIENT_ID: 'twake-mail'
}

describe('resolveConfig', () => {
  it('defaults to OIDC with the redirect URIs of the origin', () => {
    const result = resolveConfig(OIDC_SOURCE, ORIGIN)

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        jmapSessionUrl: 'https://jmap.example.com/jmap/session',
        authMode: 'oidc',
        oidc: {
          issuerUrl: 'https://sso.example.com',
          clientId: 'twake-mail',
          scope: DEFAULT_SSO_SCOPE,
          redirectUri: 'https://mail.example.com/callback',
          postLogoutRedirectUri: 'https://mail.example.com/'
        },
        debug: false,
        sentryDsn: null,
        forwardWarningMessage: null,
        workplaceEmbedding: false,
        tdriveIntentUrl: null,
        appVersion: 'dev',
        appList: []
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

  it('accepts the basic mode without any SSO setting', () => {
    const result = resolveConfig(
      {
        JMAP_SESSION_URL: 'http://localhost/jmap/session',
        AUTH_MODE: 'basic'
      },
      ORIGIN
    )

    expect(result.ok && result.value.authMode).toBe('basic')
    expect(result.ok && result.value.oidc).toBe(null)
  })

  it('reports every missing required entry at once', () => {
    const result = resolveConfig({ SSO_CLIENT_ID: '  ' }, ORIGIN)

    expect(result).toEqual({
      ok: false,
      errors: [
        'JMAP_SESSION_URL must be an absolute http(s) URL',
        'SSO_BASE_URL must be an absolute http(s) URL',
        'SSO_CLIENT_ID is required'
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

  it('reads DEBUG written as a string and keeps only valid app list entries', () => {
    const result = resolveConfig(
      {
        ...OIDC_SOURCE,
        DEBUG: 'true',
        appList: [
          { name: 'Chat', link: 'https://chat.example.com', icon: '/chat.svg' },
          { name: 'Broken' },
          'nonsense'
        ]
      },
      ORIGIN
    )

    expect(result.ok && result.value.debug).toBe(true)
    expect(result.ok && result.value.appList).toEqual([
      { name: 'Chat', link: 'https://chat.example.com', icon: '/chat.svg' }
    ])
  })
})
