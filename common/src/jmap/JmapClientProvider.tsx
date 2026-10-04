import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode
} from 'react'

import { useAuthService } from '@common/features/auth/AuthProvider'

import { makeJmapAuth } from './makeJmapAuth'
import type { JmapClient, JmapClientFactory } from './types'

const JmapClientContext = createContext<JmapClient | null>(null)

export interface JmapClientProviderProps {
  /**
   * `createClient` of jmap-client-ts, null until the library is added.
   * TODO(jmap-client-ts v2): pass `createClient` from the App.
   */
  createClient: JmapClientFactory | null
  sessionUrl: string
  children: ReactNode
}

/**
 * Creates the JMAP client of the session, authenticated by the current
 * authentication service, and provides it to `useJmapClient`.
 */
export function JmapClientProvider({
  createClient,
  sessionUrl,
  children
}: JmapClientProviderProps): ReactElement {
  const authService = useAuthService()
  const client = useMemo(
    () =>
      createClient
        ? createClient({ sessionUrl, auth: makeJmapAuth(authService) })
        : null,
    [createClient, sessionUrl, authService]
  )

  return (
    <JmapClientContext.Provider value={client}>
      {children}
    </JmapClientContext.Provider>
  )
}

/**
 * The JMAP client, for the query functions of the features.
 */
export function useJmapClient(): JmapClient {
  const client = useContext(JmapClientContext)
  if (!client) {
    throw new Error(
      'useJmapClient needs a JmapClientProvider given a createClient factory'
    )
  }
  return client
}
