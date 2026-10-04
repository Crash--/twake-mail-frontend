import { ANONYMOUS, type AuthState } from './types'

export interface AuthStore {
  getState: () => AuthState
  setState: (state: AuthState) => void
  subscribe: (listener: () => void) => () => void
}

/**
 * A minimal observable holding the authentication state, read by React
 * through `useSyncExternalStore`.
 */
export function makeAuthStore(): AuthStore {
  let state: AuthState = ANONYMOUS
  const listeners = new Set<() => void>()

  return {
    getState: () => state,
    setState: next => {
      state = next
      listeners.forEach(listener => listener())
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
