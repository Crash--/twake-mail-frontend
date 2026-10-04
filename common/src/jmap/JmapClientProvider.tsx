import type { createClient, JmapClient } from 'jmap-client-ts'
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  useAuthService,
  useAuthState
} from '@common/features/auth/AuthProvider'

import { LINAGORA_METHOD_CAPABILITIES } from './linagoraMethods'
import { makeJmapAuth } from './makeJmapAuth'

/** `createClient` of jmap-client-ts, or a wrapper of it in tests */
export type JmapClientFactory = typeof createClient

const JmapClientContext = createContext<JmapClient | null>(null)

export interface JmapClientProviderProps {
  createClient: JmapClientFactory
  sessionUrl: string
  children: ReactNode
}

/**
 * Creates the JMAP client of the signed-in user, authenticated by the
 * current authentication service, and provides it to `useJmapClient`.
 *
 * A new client is created at each sign-in: the client caches the JMAP
 * session, which belongs to the user who signed in. Renewing the tokens does
 * not change the authentication status, hence keeps the client.
 */
export function JmapClientProvider({
  createClient,
  sessionUrl,
  children
}: JmapClientProviderProps): ReactElement {
  const authService = useAuthService()
  const { status } = useAuthState()
  const client = useMemo(
    () =>
      status === 'authenticated'
        ? createClient({
            sessionUrl,
            auth: makeJmapAuth(authService),
            methodCapabilities: LINAGORA_METHOD_CAPABILITIES
          })
        : null,
    [createClient, sessionUrl, authService, status]
  )

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
