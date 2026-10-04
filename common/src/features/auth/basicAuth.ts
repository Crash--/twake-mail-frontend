import { makeAuthStore } from './authStore'
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
}

function makeDefaultDependencies(): BasicDependencies {
  return { fetch: (input, init) => fetch(input, init) }
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
 * only: each tab, and each reload, asks for them again.
 */
export function createBasicAuthService(
  config: { jmapSessionUrl: string },
  dependencies: BasicDependencies = makeDefaultDependencies()
): BasicAuthService {
  const store = makeAuthStore()
  let authorizationHeader: string | null = null

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
    if (result.ok) {
      authorizationHeader = header
      store.setState({
        status: 'authenticated',
        user: { email: username.trim(), name: null }
      })
    }
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
