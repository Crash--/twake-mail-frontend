import { makeAuthStore } from './authStore'
import {
  makeBasicSessionSharing,
  type BasicSessionSharing,
  type SharedBasicSession
} from './basicSessionSharing'
import { endLocalSession } from './localSession'
import {
  ANONYMOUS,
  type BasicAuthService,
  type BasicLoginResult
} from './types'

type FetchFunction = (
  input: string,
  init: RequestInit
) => Promise<Pick<Response, 'ok' | 'status'>>

export interface BasicDependencies {
  fetch: FetchFunction
  /** Hands the session over between tabs; absent, every tab signs in */
  sessionSharing?: BasicSessionSharing | null
}

function makeDefaultDependencies(): BasicDependencies {
  return {
    fetch: (input, init) => fetch(input, init),
    sessionSharing: makeBasicSessionSharing()
  }
}

/**
 * `Basic` authorization header value; the credentials are UTF-8 encoded, as
 * James and most JMAP servers expect (RFC 7617 `charset="UTF-8"`).
 */
export function makeBasicAuthorizationHeader(
  username: string,
  password: string
): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return `Basic ${btoa(binary)}`
}

/**
 * Checks credentials by fetching the JMAP session resource with them.
 */
export async function validateBasicCredentials(
  sessionUrl: string,
  authorizationHeader: string,
  fetchFunction: FetchFunction
): Promise<BasicLoginResult> {
  let response: Pick<Response, 'ok' | 'status'>
  try {
    response = await fetchFunction(sessionUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorizationHeader
      },
      credentials: 'omit',
      cache: 'no-store'
    })
  } catch {
    return { ok: false, error: 'network-error' }
  }

  if (response.ok) return { ok: true }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: 'invalid-credentials' }
  }
  return { ok: false, error: 'unexpected-response' }
}

/**
 * HTTP Basic authentication, for parity with tmail-flutter and for local
 * development and end-to-end tests. The credentials are held in memory
 * only, never in web storage: a new tab, or a reload, gets them from
 * another signed-in tab of the application (`basicSessionSharing.ts`) and
 * asks for them again when there is none.
 */
export function createBasicAuthService(
  config: { jmapSessionUrl: string },
  dependencies: BasicDependencies = makeDefaultDependencies()
): BasicAuthService {
  const store = makeAuthStore()
  const sessionSharing = dependencies.sessionSharing ?? null
  let authorizationHeader: string | null = null

  function signIn(email: string, header: string): void {
    authorizationHeader = header
    store.setState({
      status: 'authenticated',
      user: { email, name: null, workplaceFqdn: null }
    })
  }

  function getSharedSession(): SharedBasicSession | null {
    const state = store.getState()
    return state.status === 'authenticated' &&
      state.user.email !== null &&
      authorizationHeader !== null
      ? { email: state.user.email, authorizationHeader }
      : null
  }

  /**
   * Takes the session of another tab, unless the user signed in meanwhile
   */
  async function restoreFromOtherTab(
    sharing: BasicSessionSharing
  ): Promise<void> {
    store.setState({ status: 'restoring' })
    const session = await sharing.request()
    if (store.getState().status !== 'restoring') return

    if (session === null) store.setState(ANONYMOUS)
    else signIn(session.email, session.authorizationHeader)
  }

  if (sessionSharing !== null) {
    // Lives as long as the page: the service is created once per page
    sessionSharing.share(getSharedSession)
    restoreFromOtherTab(sessionSharing).catch((error: unknown) => {
      console.error('[auth] Cannot get the session of another tab', error)
      store.setState(ANONYMOUS)
    })
  }

  async function login(
    username: string,
    password: string
  ): Promise<BasicLoginResult> {
    const header = makeBasicAuthorizationHeader(username.trim(), password)
    const result = await validateBasicCredentials(
      config.jmapSessionUrl,
      header,
      dependencies.fetch
    )
    if (result.ok) signIn(username.trim(), header)
    return result
  }

  function clearLocalSession(): void {
    authorizationHeader = null
    store.setState(ANONYMOUS)
  }

  const service: BasicAuthService = {
    mode: 'basic',
    getState: store.getState,
    subscribe: store.subscribe,
    getAuthorizationHeader: () => Promise.resolve(authorizationHeader),
    // The server refuses the credentials: nothing to renew them with, the
    // user signs in again
    onUnauthorized: () => {
      clearLocalSession()
      return Promise.resolve(false)
    },
    clearLocalSession,
    logout: () => {
      endLocalSession(service)
      return Promise.resolve()
    },
    login
  }

  return service
}
