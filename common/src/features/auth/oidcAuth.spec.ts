import * as client from 'openid-client'

import type { OidcConfig } from '@common/config/config'

import {
  createOidcAuthService,
  PENDING_LOGIN_STORAGE_KEY,
  type OidcDependencies
} from './oidcAuth'

jest.mock('openid-client', () => ({
  clockSkew: Symbol('clockSkew'),
  discovery: jest.fn(),
  None: jest.fn(),
  allowInsecureRequests: jest.fn(),
  randomPKCECodeVerifier: jest.fn(),
  calculatePKCECodeChallenge: jest.fn(),
  randomState: jest.fn(),
  buildAuthorizationUrl: jest.fn(),
  authorizationCodeGrant: jest.fn(),
  refreshTokenGrant: jest.fn(),
  buildEndSessionUrl: jest.fn(),
  fetchUserInfo: jest.fn(),
  skipSubjectCheck: Symbol('skipSubjectCheck')
}))

const mockedClient = jest.mocked(client)

const CONFIG: OidcConfig = {
  issuerUrl: 'https://sso.example.com',
  clientId: 'twake-mail',
  scope: 'openid email offline_access',
  redirectUri: 'https://mail.example.com/callback',
  postLogoutRedirectUri: 'https://mail.example.com/'
}

const CALLBACK_URL = new URL(
  'https://mail.example.com/callback?code=abc&state=state-1'
)

type TokenResponse = Awaited<ReturnType<typeof client.refreshTokenGrant>>

const FULL_PROFILE = { email: 'alice@example.com', name: 'Alice Martin' }
const FULL_USER = { ...FULL_PROFILE, workplaceFqdn: null }

function makeTokenResponse(
  accessToken: string,
  {
    expiresIn = 300,
    profile = FULL_PROFILE
  }: { expiresIn?: number; profile?: Record<string, string> } = {}
): TokenResponse {
  const response: client.TokenEndpointResponse = {
    access_token: accessToken,
    refresh_token: `refresh-of-${accessToken}`,
    id_token: `id-of-${accessToken}`,
    token_type: 'bearer',
    expires_in: expiresIn
  }
  const helpers: client.TokenEndpointResponseHelpers = {
    expiresIn: () => expiresIn,
    claims: () => ({
      iss: CONFIG.issuerUrl,
      sub: 'alice',
      aud: CONFIG.clientId,
      iat: 0,
      exp: 0,
      ...profile
    })
  }
  return Object.assign(response, helpers)
}

function makeMemoryStorage(): OidcDependencies['storage'] {
  const items = new Map<string, string>()
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
    removeItem: key => {
      items.delete(key)
    }
  }
}

function makeDependencies(): OidcDependencies {
  return {
    storage: makeMemoryStorage(),
    redirect: jest.fn(),
    getCurrentPath: () => '/mailbox/inbox?page=2',
    now: () => Date.now()
  }
}

async function signIn(
  dependencies: OidcDependencies
): Promise<ReturnType<typeof createOidcAuthService>> {
  const service = createOidcAuthService(CONFIG, dependencies)
  await service.startLogin('/mailbox/inbox')
  mockedClient.authorizationCodeGrant.mockResolvedValueOnce(
    makeTokenResponse('access-1')
  )
  await service.handleCallback(CALLBACK_URL)
  return service
}

const { Configuration } = jest.requireActual<typeof client>('openid-client')

describe('createOidcAuthService', () => {
  const configuration = new Configuration(
    { issuer: CONFIG.issuerUrl },
    CONFIG.clientId
  )

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] })
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    mockedClient.discovery.mockResolvedValue(configuration)
    mockedClient.randomPKCECodeVerifier.mockReturnValue('verifier-1')
    mockedClient.calculatePKCECodeChallenge.mockResolvedValue('challenge-1')
    mockedClient.randomState.mockReturnValue('state-1')
    mockedClient.buildAuthorizationUrl.mockReturnValue(
      new URL('https://sso.example.com/authorize?client_id=twake-mail')
    )
    mockedClient.buildEndSessionUrl.mockReturnValue(
      new URL('https://sso.example.com/logout')
    )
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('startLogin', () => {
    it('saves the PKCE verifier and state, then redirects to the SSO', async () => {
      const dependencies = makeDependencies()
      const service = createOidcAuthService(CONFIG, dependencies)

      await expect(service.startLogin('/mailbox/inbox')).resolves.toEqual({
        ok: true
      })

      expect(mockedClient.buildAuthorizationUrl).toHaveBeenCalledWith(
        configuration,
        {
          redirect_uri: CONFIG.redirectUri,
          scope: CONFIG.scope,
          code_challenge: 'challenge-1',
          code_challenge_method: 'S256',
          state: 'state-1'
        }
      )
      expect(
        JSON.parse(
          dependencies.storage.getItem(PENDING_LOGIN_STORAGE_KEY) ?? 'null'
        )
      ).toEqual({
        codeVerifier: 'verifier-1',
        state: 'state-1',
        returnTo: '/mailbox/inbox'
      })
      expect(dependencies.redirect).toHaveBeenCalledWith(
        'https://sso.example.com/authorize?client_id=twake-mail'
      )
    })

    it('never sends the user back outside the application', async () => {
      const dependencies = makeDependencies()
      const service = createOidcAuthService(CONFIG, dependencies)

      await service.startLogin('https://evil.example.com/')

      expect(dependencies.storage.getItem(PENDING_LOGIN_STORAGE_KEY)).toContain(
        '"returnTo":"/"'
      )
    })

    it('reports an unreachable SSO', async () => {
      mockedClient.discovery.mockRejectedValueOnce(new Error('timeout'))
      const dependencies = makeDependencies()
      const service = createOidcAuthService(CONFIG, dependencies)

      await expect(service.startLogin('/')).resolves.toEqual({
        ok: false,
        error: 'timeout'
      })
      expect(dependencies.redirect).not.toHaveBeenCalled()
    })
  })

  describe('handleCallback', () => {
    it('exchanges the code with the saved verifier and state', async () => {
      const dependencies = makeDependencies()
      const service = createOidcAuthService(CONFIG, dependencies)
      await service.startLogin('/mailbox/inbox')
      mockedClient.authorizationCodeGrant.mockResolvedValueOnce(
        makeTokenResponse('access-1')
      )

      const result = await service.handleCallback(CALLBACK_URL)

      expect(result).toEqual({
        ok: true,
        value: { returnTo: '/mailbox/inbox' }
      })
      expect(mockedClient.authorizationCodeGrant).toHaveBeenCalledWith(
        configuration,
        CALLBACK_URL,
        { pkceCodeVerifier: 'verifier-1', expectedState: 'state-1' }
      )
      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: FULL_USER
      })
      await expect(service.getAuthorizationHeader()).resolves.toBe(
        'Bearer access-1'
      )
      expect(dependencies.storage.getItem(PENDING_LOGIN_STORAGE_KEY)).toBe(null)
    })

    it('fails without a pending login', async () => {
      const service = createOidcAuthService(CONFIG, makeDependencies())

      await expect(service.handleCallback(CALLBACK_URL)).resolves.toEqual({
        ok: false,
        error: 'missing-login-state'
      })
      expect(mockedClient.authorizationCodeGrant).not.toHaveBeenCalled()
    })

    it('fails when the SSO refuses the code', async () => {
      const service = createOidcAuthService(CONFIG, makeDependencies())
      await service.startLogin('/')
      mockedClient.authorizationCodeGrant.mockRejectedValueOnce(
        new Error('invalid_grant')
      )

      await expect(service.handleCallback(CALLBACK_URL)).resolves.toEqual({
        ok: false,
        error: 'token-exchange-failed',
        detail: 'invalid_grant'
      })
      expect(service.getState()).toEqual({ status: 'anonymous' })
    })
  })

  describe('refresh', () => {
    it('sends a single refresh request for concurrent callers', async () => {
      const service = await signIn(makeDependencies())
      let resolveRefresh: (response: TokenResponse) => void = () => undefined
      mockedClient.refreshTokenGrant.mockReturnValueOnce(
        new Promise(resolve => {
          resolveRefresh = resolve
        })
      )

      const results = Promise.all([
        service.refresh(),
        service.refresh(),
        service.onUnauthorized()
      ])
      resolveRefresh(makeTokenResponse('access-2'))

      await expect(results).resolves.toEqual([true, true, true])
      expect(mockedClient.refreshTokenGrant).toHaveBeenCalledTimes(1)
      expect(mockedClient.refreshTokenGrant).toHaveBeenCalledWith(
        configuration,
        'refresh-of-access-1'
      )
      await expect(service.getAuthorizationHeader()).resolves.toBe(
        'Bearer access-2'
      )
    })

    it('starts a new request once the previous one is over', async () => {
      const service = await signIn(makeDependencies())
      mockedClient.refreshTokenGrant
        .mockResolvedValueOnce(makeTokenResponse('access-2'))
        .mockResolvedValueOnce(makeTokenResponse('access-3'))

      await service.refresh()
      await service.refresh()

      expect(mockedClient.refreshTokenGrant).toHaveBeenCalledTimes(2)
      expect(mockedClient.refreshTokenGrant).toHaveBeenLastCalledWith(
        configuration,
        'refresh-of-access-2'
      )
    })

    it('renews the tokens a minute before they expire', async () => {
      const service = await signIn(makeDependencies())
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        makeTokenResponse('access-2')
      )

      await jest.advanceTimersByTimeAsync(239_000)
      expect(mockedClient.refreshTokenGrant).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(1_000)
      expect(mockedClient.refreshTokenGrant).toHaveBeenCalledTimes(1)
      await expect(service.getAuthorizationHeader()).resolves.toBe(
        'Bearer access-2'
      )
    })

    it('renews an expired token before sending it', async () => {
      const service = await signIn(makeDependencies())
      // The scheduled refresh did not run, e.g. the computer was asleep
      jest.clearAllTimers()
      jest.setSystemTime(Date.now() + 300_000)
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        makeTokenResponse('access-2')
      )

      await expect(service.getAuthorizationHeader()).resolves.toBe(
        'Bearer access-2'
      )
    })
  })

  describe('onUnauthorized', () => {
    it('lets the request be retried when the refresh succeeds', async () => {
      const dependencies = makeDependencies()
      const service = await signIn(dependencies)
      jest.mocked(dependencies.redirect).mockClear()
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        makeTokenResponse('access-2')
      )

      await expect(service.onUnauthorized()).resolves.toBe(true)
      expect(dependencies.redirect).not.toHaveBeenCalled()
    })

    it('goes back to the SSO, then to the current page, when the refresh fails', async () => {
      const dependencies = makeDependencies()
      const service = await signIn(dependencies)
      jest.mocked(dependencies.redirect).mockClear()
      mockedClient.refreshTokenGrant.mockRejectedValueOnce(
        new Error('invalid_grant')
      )
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)

      await expect(service.onUnauthorized()).resolves.toBe(false)

      expect(dependencies.redirect).toHaveBeenCalledWith(
        'https://sso.example.com/authorize?client_id=twake-mail'
      )
      expect(dependencies.storage.getItem(PENDING_LOGIN_STORAGE_KEY)).toContain(
        '"returnTo":"/mailbox/inbox?page=2"'
      )
    })
  })

  describe('user', () => {
    it('reads the name and email from the ID token', async () => {
      const service = await signIn(makeDependencies())

      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: FULL_USER
      })
      expect(mockedClient.fetchUserInfo).not.toHaveBeenCalled()
    })

    it('reads the Twake Workplace of the user from its claim', async () => {
      const service = createOidcAuthService(CONFIG, makeDependencies())
      await service.startLogin('/')
      mockedClient.authorizationCodeGrant.mockResolvedValueOnce(
        makeTokenResponse('access-1', {
          profile: { ...FULL_PROFILE, workplaceFqdn: 'acme.twake.example.com' }
        })
      )

      await service.handleCallback(CALLBACK_URL)

      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: { ...FULL_PROFILE, workplaceFqdn: 'acme.twake.example.com' }
      })
    })

    it('gives the ID token of the session, none once signed out', async () => {
      const service = await signIn(makeDependencies())

      expect(service.getIdToken()).toBe('id-of-access-1')
      service.clearLocalSession()
      expect(service.getIdToken()).toBe(null)
    })

    it('asks userinfo for what the ID token does not say', async () => {
      const service = createOidcAuthService(CONFIG, makeDependencies())
      await service.startLogin('/')
      mockedClient.authorizationCodeGrant.mockResolvedValueOnce(
        makeTokenResponse('access-1', { profile: {} })
      )
      mockedClient.fetchUserInfo.mockResolvedValueOnce({
        sub: 'alice',
        email: 'alice@example.com',
        name: 'Alice Martin'
      })

      await service.handleCallback(CALLBACK_URL)

      expect(mockedClient.fetchUserInfo).toHaveBeenCalledWith(
        configuration,
        'access-1',
        'alice'
      )
      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: FULL_USER
      })
    })

    it('keeps that user when a renewed ID token says less', async () => {
      const service = createOidcAuthService(CONFIG, makeDependencies())
      await service.startLogin('/')
      mockedClient.authorizationCodeGrant.mockResolvedValueOnce(
        makeTokenResponse('access-1', { profile: {} })
      )
      mockedClient.fetchUserInfo.mockResolvedValueOnce({
        sub: 'alice',
        ...FULL_PROFILE
      })
      await service.handleCallback(CALLBACK_URL)
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        makeTokenResponse('access-2', { profile: {} })
      )

      await service.refresh()

      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: FULL_USER
      })
    })

    it('signs in without a name nor an email when userinfo fails', async () => {
      const service = createOidcAuthService(CONFIG, makeDependencies())
      await service.startLogin('/')
      mockedClient.authorizationCodeGrant.mockResolvedValueOnce(
        makeTokenResponse('access-1', { profile: {} })
      )
      mockedClient.fetchUserInfo.mockRejectedValueOnce(new Error('timeout'))
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)

      await expect(service.handleCallback(CALLBACK_URL)).resolves.toEqual({
        ok: true,
        value: { returnTo: '/' }
      })
      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: { email: null, name: null, workplaceFqdn: null }
      })
    })
  })

  describe('logout', () => {
    it('ends the local session, then the SSO session with the id token', async () => {
      const dependencies = makeDependencies()
      const service = await signIn(dependencies)
      const postMessage = jest.spyOn(BroadcastChannel.prototype, 'postMessage')

      await service.logout()

      expect(service.getState()).toEqual({ status: 'anonymous' })
      await expect(service.getAuthorizationHeader()).resolves.toBe(null)
      expect(postMessage).toHaveBeenCalledWith('session-ended')
      expect(mockedClient.buildEndSessionUrl).toHaveBeenCalledWith(
        configuration,
        {
          post_logout_redirect_uri: CONFIG.postLogoutRedirectUri,
          id_token_hint: 'id-of-access-1'
        }
      )
      expect(dependencies.redirect).toHaveBeenLastCalledWith(
        'https://sso.example.com/logout'
      )
    })

    it('starts no login while leaving for the SSO logout', async () => {
      const dependencies = makeDependencies()
      const service = await signIn(dependencies)
      mockedClient.buildAuthorizationUrl.mockClear()
      // As RequireAuth does when the user becomes anonymous
      const unsubscribe = service.subscribe(() => {
        if (service.getState().status === 'anonymous') {
          void service.startLogin('/mailbox/inbox')
        }
      })

      await service.logout()
      await jest.runAllTimersAsync()
      unsubscribe()

      expect(mockedClient.buildAuthorizationUrl).not.toHaveBeenCalled()
      expect(dependencies.redirect).toHaveBeenLastCalledWith(
        'https://sso.example.com/logout'
      )
    })

    it('falls back to the post-logout page when the SSO cannot end its session', async () => {
      const dependencies = makeDependencies()
      const service = await signIn(dependencies)
      mockedClient.buildEndSessionUrl.mockImplementationOnce(() => {
        throw new Error('end_session_endpoint missing')
      })
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)

      await service.logout()

      expect(dependencies.redirect).toHaveBeenLastCalledWith(
        CONFIG.postLogoutRedirectUri
      )
    })
  })
})
