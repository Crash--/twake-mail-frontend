import * as twakeOidc from '@linagora/twake-oidc'
import * as client from 'openid-client'

import type { OidcConfig } from '@common/config/config'

import {
  createOidcAuthService,
  peekPendingLoginReturnTo,
  type OidcDependencies,
  type OidcOptions
} from './oidcAuth'

jest.mock('@linagora/twake-oidc', () => ({
  ...jest.requireActual<typeof twakeOidc>('@linagora/twake-oidc'),
  configureAuth: jest.fn(),
  startLogin: jest.fn(),
  completeLogin: jest.fn(),
  getPendingReturnTo: jest.fn(),
  logOut: jest.fn()
}))

jest.mock('openid-client', () => ({
  clockSkew: Symbol('clockSkew'),
  discovery: jest.fn(),
  None: jest.fn(),
  allowInsecureRequests: jest.fn(),
  refreshTokenGrant: jest.fn()
}))

const mockedOidc = jest.mocked(twakeOidc)
const mockedClient = jest.mocked(client)

const CONFIG: OidcConfig = {
  issuerUrl: 'https://sso.example.com',
  clientId: 'twake-mail',
  scope: 'openid email offline_access',
  redirectUri: 'https://mail.example.com/callback',
  postLogoutRedirectUri: 'https://mail.example.com/'
}

const OPTIONS: OidcOptions = {
  apiUrl: 'https://jmap.example.com/jmap/session'
}

type TokenSet = twakeOidc.TokenSet

const FULL_PROFILE = { email: 'alice@example.com', name: 'Alice Martin' }
const FULL_USER = { ...FULL_PROFILE, workplaceFqdn: null }

function makeTokenSet(
  accessToken: string,
  {
    expiresIn = 300,
    profile = FULL_PROFILE
  }: { expiresIn?: number; profile?: Record<string, string> } = {}
): TokenSet {
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

function makeLoginResult(
  tokenSet: TokenSet,
  {
    userinfo = {},
    returnTo = '/mailbox/inbox'
  }: { userinfo?: Record<string, string>; returnTo?: string } = {}
): twakeOidc.LoginResult {
  return { tokenSet, userinfo: { sub: 'alice', ...userinfo }, returnTo }
}

function makeDependencies(): OidcDependencies {
  return { now: () => Date.now() }
}

async function signIn(
  dependencies: OidcDependencies = makeDependencies()
): Promise<ReturnType<typeof createOidcAuthService>> {
  const service = createOidcAuthService(CONFIG, OPTIONS, dependencies)
  mockedOidc.completeLogin.mockResolvedValueOnce(
    makeLoginResult(makeTokenSet('access-1'))
  )
  await service.handleCallback()
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
    mockedOidc.logOut.mockResolvedValue(undefined)
    mockedOidc.startLogin.mockResolvedValue(undefined)
  })

  afterEach(() => {
    twakeOidc.clearTokenSet()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('configuration', () => {
    it('configures twake-oidc with the SSO and the JMAP server', () => {
      createOidcAuthService(CONFIG, OPTIONS, makeDependencies())

      expect(mockedOidc.configureAuth).toHaveBeenCalledWith({
        ssoUrl: CONFIG.issuerUrl,
        clientId: CONFIG.clientId,
        scope: CONFIG.scope,
        redirectUri: CONFIG.redirectUri,
        postLogoutRedirectUri: CONFIG.postLogoutRedirectUri,
        apiUrl: OPTIONS.apiUrl,
        framed: false
      })
    })

    it('logs in silently in a frame, back to the redirect URI it is given', () => {
      createOidcAuthService(
        CONFIG,
        {
          ...OPTIONS,
          framed: true,
          redirectUri: 'https://mail.example.com/intents/callback'
        },
        makeDependencies()
      )

      expect(mockedOidc.configureAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: 'https://mail.example.com/intents/callback',
          framed: true
        })
      )
    })
  })

  describe('startLogin', () => {
    it('leaves for the SSO once, however many callers ask', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())

      await expect(service.startLogin()).resolves.toEqual({ ok: true })
      await expect(service.startLogin()).resolves.toEqual({ ok: true })

      expect(mockedOidc.startLogin).toHaveBeenCalledTimes(1)
    })

    it('reports an unreachable SSO, and lets the user try again', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      mockedOidc.startLogin.mockRejectedValueOnce(new Error('timeout'))

      await expect(service.startLogin()).resolves.toEqual({
        ok: false,
        error: 'timeout'
      })
      await expect(service.startLogin()).resolves.toEqual({ ok: true })
      expect(mockedOidc.startLogin).toHaveBeenCalledTimes(2)
    })
  })

  describe('handleCallback', () => {
    it('signs in with the tokens of the SSO and comes back where the login started', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      mockedOidc.completeLogin.mockResolvedValueOnce(
        makeLoginResult(makeTokenSet('access-1'), {
          returnTo: '/mailbox/inbox?page=2'
        })
      )

      await expect(service.handleCallback()).resolves.toEqual({
        ok: true,
        value: { returnTo: '/mailbox/inbox?page=2' }
      })
      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: FULL_USER
      })
      await expect(service.getAuthorizationHeader()).resolves.toBe(
        'Bearer access-1'
      )
    })

    it('never sends the user back outside the application', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      mockedOidc.completeLogin.mockResolvedValueOnce(
        makeLoginResult(makeTokenSet('access-1'), {
          returnTo: '//evil.example.com'
        })
      )

      await expect(service.handleCallback()).resolves.toEqual({
        ok: true,
        value: { returnTo: '/' }
      })
    })

    it('fails without a pending login', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      mockedOidc.completeLogin.mockResolvedValueOnce(null)

      await expect(service.handleCallback()).resolves.toEqual({
        ok: false,
        error: 'missing-login-state'
      })
    })

    it('says when the SSO needs the user for a silent login', async () => {
      const service = createOidcAuthService(
        CONFIG,
        { ...OPTIONS, framed: true },
        makeDependencies()
      )
      mockedOidc.completeLogin.mockRejectedValueOnce(
        new twakeOidc.LoginRequiredError('/embed/team-mailboxes/a@b.c/')
      )

      await expect(service.handleCallback()).resolves.toEqual({
        ok: false,
        error: 'login-required',
        returnTo: '/embed/team-mailboxes/a@b.c/'
      })
      expect(service.getState()).toEqual({ status: 'anonymous' })
    })

    it('fails when the SSO refuses the code', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      mockedOidc.completeLogin.mockRejectedValueOnce(new Error('invalid_grant'))

      await expect(service.handleCallback()).resolves.toEqual({
        ok: false,
        error: 'token-exchange-failed',
        detail: 'invalid_grant'
      })
      expect(service.getState()).toEqual({ status: 'anonymous' })
    })

    it('lets a later 401 leave for the SSO again', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      await service.startLogin()
      mockedOidc.completeLogin.mockResolvedValueOnce(null)

      await service.handleCallback()
      await service.startLogin()

      expect(mockedOidc.startLogin).toHaveBeenCalledTimes(2)
    })
  })

  describe('peekPendingLoginReturnTo', () => {
    it('reads where the pending login comes back to', () => {
      mockedOidc.getPendingReturnTo.mockReturnValueOnce('/intents?intent=i1')

      expect(peekPendingLoginReturnTo()).toBe('/intents?intent=i1')
    })

    it('is null without a pending login, / outside the application', () => {
      mockedOidc.getPendingReturnTo.mockReturnValueOnce(null)
      expect(peekPendingLoginReturnTo()).toBe(null)

      mockedOidc.getPendingReturnTo.mockReturnValueOnce('https://evil.com/')
      expect(peekPendingLoginReturnTo()).toBe('/')
    })
  })

  describe('refresh', () => {
    it('sends a single refresh request for concurrent callers', async () => {
      const service = await signIn()
      let resolveRefresh: (response: TokenSet) => void = () => undefined
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
      resolveRefresh(makeTokenSet('access-2'))

      await expect(results).resolves.toEqual([true, true, true])
      expect(mockedClient.refreshTokenGrant).toHaveBeenCalledTimes(1)
      expect(mockedClient.refreshTokenGrant).toHaveBeenCalledWith(
        configuration,
        'refresh-of-access-1'
      )
      await expect(service.getAuthorizationHeader()).resolves.toBe(
        'Bearer access-2'
      )
      expect(twakeOidc.getAccessToken()).toBe('access-2')
    })

    it('starts a new request once the previous one is over', async () => {
      const service = await signIn()
      mockedClient.refreshTokenGrant
        .mockResolvedValueOnce(makeTokenSet('access-2'))
        .mockResolvedValueOnce(makeTokenSet('access-3'))

      await service.refresh()
      await service.refresh()

      expect(mockedClient.refreshTokenGrant).toHaveBeenCalledTimes(2)
      expect(mockedClient.refreshTokenGrant).toHaveBeenLastCalledWith(
        configuration,
        'refresh-of-access-2'
      )
    })

    it('renews the tokens a minute before they expire', async () => {
      const service = await signIn()
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        makeTokenSet('access-2')
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
      const service = await signIn()
      // The scheduled refresh did not run, e.g. the computer was asleep
      jest.clearAllTimers()
      jest.setSystemTime(Date.now() + 300_000)
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        makeTokenSet('access-2')
      )

      await expect(service.getAuthorizationHeader()).resolves.toBe(
        'Bearer access-2'
      )
    })
  })

  describe('onUnauthorized', () => {
    it('lets the request be retried when the refresh succeeds', async () => {
      const service = await signIn()
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        makeTokenSet('access-2')
      )

      await expect(service.onUnauthorized()).resolves.toBe(true)
      expect(mockedOidc.startLogin).not.toHaveBeenCalled()
    })

    it('goes back to the SSO when the refresh fails', async () => {
      const service = await signIn()
      mockedClient.refreshTokenGrant.mockRejectedValueOnce(
        new Error('invalid_grant')
      )
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)

      await expect(service.onUnauthorized()).resolves.toBe(false)

      expect(mockedOidc.startLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('user', () => {
    it('reads the name and email from the ID token', async () => {
      const service = await signIn()

      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: FULL_USER
      })
    })

    it('reads the Twake Workplace of the user from its claim', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      mockedOidc.completeLogin.mockResolvedValueOnce(
        makeLoginResult(
          makeTokenSet('access-1', {
            profile: {
              ...FULL_PROFILE,
              workplaceFqdn: 'acme.twake.example.com'
            }
          })
        )
      )

      await service.handleCallback()

      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: { ...FULL_PROFILE, workplaceFqdn: 'acme.twake.example.com' }
      })
    })

    it('gives the ID token of the session, none once signed out', async () => {
      const service = await signIn()

      expect(service.getIdToken()).toBe('id-of-access-1')
      service.clearLocalSession()
      expect(service.getIdToken()).toBe(null)
      await expect(service.getAuthorizationHeader()).resolves.toBe(null)
    })

    it('keeps the ID token when a renewed token set has none', async () => {
      const service = await signIn()
      const { id_token: _, ...withoutIdToken } = makeTokenSet('access-2')
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        Object.assign(withoutIdToken, {
          expiresIn: () => 300,
          claims: () => undefined
        })
      )

      await service.refresh()

      expect(service.getIdToken()).toBe('id-of-access-1')
      await expect(service.getAuthorizationHeader()).resolves.toBe(
        'Bearer access-2'
      )
    })

    it('reads from userinfo what the ID token does not say', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      mockedOidc.completeLogin.mockResolvedValueOnce(
        makeLoginResult(makeTokenSet('access-1', { profile: {} }), {
          userinfo: FULL_PROFILE
        })
      )

      await service.handleCallback()

      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: FULL_USER
      })
    })

    it('keeps that user when a renewed ID token says less', async () => {
      const service = createOidcAuthService(CONFIG, OPTIONS, makeDependencies())
      mockedOidc.completeLogin.mockResolvedValueOnce(
        makeLoginResult(makeTokenSet('access-1', { profile: {} }), {
          userinfo: FULL_PROFILE
        })
      )
      await service.handleCallback()
      mockedClient.refreshTokenGrant.mockResolvedValueOnce(
        makeTokenSet('access-2', { profile: {} })
      )

      await service.refresh()

      expect(service.getState()).toEqual({
        status: 'authenticated',
        user: FULL_USER
      })
    })
  })

  describe('logout', () => {
    it('signs the other tabs out, then leaves through twake-oidc with the ID token', async () => {
      const service = await signIn()
      const postMessage = jest.spyOn(BroadcastChannel.prototype, 'postMessage')
      const idTokensAtLogOut: (string | undefined)[] = []
      mockedOidc.logOut.mockImplementationOnce(() => {
        idTokensAtLogOut.push(twakeOidc.getIdToken())
        return Promise.resolve()
      })

      await service.logout()

      expect(service.getState()).toEqual({
        status: 'anonymous',
        signedOut: true
      })
      expect(postMessage).toHaveBeenCalledWith({
        type: 'session-ended',
        email: 'alice@example.com'
      })
      // logOut hands it to the SSO as id_token_hint
      expect(idTokensAtLogOut).toEqual(['id-of-access-1'])
    })

    it('starts no login while leaving for the SSO logout', async () => {
      const service = await signIn()
      // As RequireAuth does when the user becomes anonymous
      const unsubscribe = service.subscribe(() => {
        if (service.getState().status === 'anonymous') {
          void service.startLogin()
        }
      })

      await service.logout()
      await jest.runAllTimersAsync()
      unsubscribe()

      expect(mockedOidc.startLogin).not.toHaveBeenCalled()
      expect(mockedOidc.logOut).toHaveBeenCalledTimes(1)
    })
  })
})
