import { makeAuthStore } from '@common/features/auth/authStore'
import type {
  AuthState,
  BasicAuthService,
  OidcAuthService
} from '@common/features/auth/types'

const SIGNED_IN: AuthState = {
  status: 'authenticated',
  user: {
    email: 'alice@example.com',
    name: 'Alice Martin',
    workplaceFqdn: null
  }
}

/**
 * A basic-mode auth service whose methods are Jest mocks. Signed in as
 * Alice unless `state` says otherwise.
 */
export function makeFakeBasicAuthService(
  state: AuthState = SIGNED_IN
): BasicAuthService & { store: ReturnType<typeof makeAuthStore> } {
  const store = makeAuthStore()
  store.setState(state)
  return {
    mode: 'basic',
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    getAuthorizationHeader: jest.fn(() => Promise.resolve('Basic dGVzdA==')),
    onUnauthorized: jest.fn(() => Promise.resolve(false)),
    clearLocalSession: jest.fn(() => store.setState({ status: 'anonymous' })),
    logout: jest.fn(() => Promise.resolve()),
    login: jest.fn(() => Promise.resolve({ ok: true as const }))
  }
}

/**
 * An OIDC-mode auth service whose methods are Jest mocks.
 */
export function makeFakeOidcAuthService(
  state: AuthState = SIGNED_IN
): OidcAuthService & { store: ReturnType<typeof makeAuthStore> } {
  const store = makeAuthStore()
  store.setState(state)
  return {
    mode: 'oidc',
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    getAuthorizationHeader: jest.fn(() => Promise.resolve('Bearer token')),
    onUnauthorized: jest.fn(() => Promise.resolve(false)),
    clearLocalSession: jest.fn(() => store.setState({ status: 'anonymous' })),
    logout: jest.fn(() => Promise.resolve()),
    startLogin: jest.fn(() => Promise.resolve({ ok: true as const })),
    handleCallback: jest.fn(() =>
      Promise.resolve({ ok: true as const, value: { returnTo: '/' } })
    ),
    refresh: jest.fn(() => Promise.resolve(true)),
    getIdToken: jest.fn(() => 'id-token-alice')
  }
}
