import type { createClient, FetchFunction, JmapClient } from 'jmap-client-ts'
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode
} from 'react'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'

import {
  useAuthService,
  useAuthState
} from '@common/features/auth/AuthProvider'

import { makeJmapAuth } from './makeJmapAuth'
import { serveSessionOnce } from './serveSessionOnce'

/** `createClient` of jmap-client-ts, or a wrapper of it in tests */
export type JmapClientFactory = typeof createClient

const JmapClientContext = createContext<JmapClient | null>(null)

export interface JmapClientProviderProps {
  createClient: JmapClientFactory
  sessionUrl: string
  /** `fetch` of the client, the browser's by default */
  fetch?: FetchFunction
  children: ReactNode
}

function browserFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, init)
}

/**
 * Creates the JMAP client of the signed-in user, authenticated by the
 * current authentication service, and provides it to `useJmapClient`.
 *
 * A new client is created at each sign-in: the client caches the JMAP
 * session, which belongs to the user who signed in. Renewing the tokens does
 * not change the authentication status, hence keeps the client.
 *
 * A basic sign-in has just read the session to check the credentials: the
 * client starts from that answer rather than fetching it a second time.
 */
export function JmapClientProvider({
  createClient,
  sessionUrl,
  fetch: fetchFunction = browserFetch,
  children
}: JmapClientProviderProps): ReactElement {
  const authService = useAuthService()
  const { status } = useAuthState()
  const client = useMemo(() => {
    if (status !== 'authenticated') return null
    const sessionBody =
      authService.mode === 'basic' ? authService.getValidatedSession() : null
    return createClient({
      sessionUrl,
      auth: makeJmapAuth(authService),
      methodCapabilities: METHOD_CAPABILITIES,
      fetch:
        sessionBody === null
          ? fetchFunction
          : serveSessionOnce(fetchFunction, sessionUrl, sessionBody)
    })
  }, [createClient, sessionUrl, fetchFunction, authService, status])

  return (
    <JmapClientContext.Provider value={client}>
      {children}
    </JmapClientContext.Provider>
  )
}

export interface ScopedJmapClientProps {
  client: JmapClient
  children: ReactNode
}

/** Gives `client` to the screens below, instead of the one of the sign-in */
export function ScopedJmapClient({
  client,
  children
}: ScopedJmapClientProps): ReactElement {
  return (
    <JmapClientContext.Provider value={client}>
      {children}
    </JmapClientContext.Provider>
  )
}

/**
 * The JMAP client, for the query functions of the features. Only available
 * to signed-in screens.
 */
export function useJmapClient(): JmapClient {
  const client = useContext(JmapClientContext)
  if (!client) {
    throw new Error(
      'useJmapClient needs a JmapClientProvider and a signed-in user'
    )
  }
  return client
}
