import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode
} from 'react'

import { onSessionEndedElsewhere } from './localSession'
import type { AuthService, AuthState } from './types'

const AuthServiceContext = createContext<AuthService | null>(null)

export interface AuthProviderProps {
  service: AuthService
  children: ReactNode
}

/**
 * Provides the authentication service, ends the session of this tab when
 * another tab logs out, and drops the cached data of a session that ends.
 */
export function AuthProvider({
  service,
  children
}: AuthProviderProps): ReactElement {
  const queryClient = useQueryClient()

  useEffect(() => onSessionEndedElsewhere(service.clearLocalSession), [service])

  useEffect(
    () =>
      service.subscribe(() => {
        if (service.getState().status === 'anonymous') queryClient.clear()
      }),
    [service, queryClient]
  )

  return (
    <AuthServiceContext.Provider value={service}>
      {children}
    </AuthServiceContext.Provider>
  )
}

export function useAuthService(): AuthService {
  const service = useContext(AuthServiceContext)
  if (!service) {
    throw new Error('useAuthService must be used within an AuthProvider')
  }
  return service
}

export function useAuthState(): AuthState {
  const service = useAuthService()
  return useSyncExternalStore(service.subscribe, service.getState)
}
