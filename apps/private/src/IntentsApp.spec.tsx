import { render, screen } from '@testing-library/react'
import { createClient } from 'jmap-client-ts'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import type { AuthService } from '@common/features/auth/types'
import { JmapClientProvider } from '@common/jmap/JmapClientProvider'
import {
  FAKE_SESSION_URL,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  makeFakeBasicAuthService,
  makeFakeOidcAuthService
} from '@common/testing/makeFakeAuthService'

import { IntentsApp } from './IntentsApp'

const INTENT_PATH = '/intents?intent=intent-1'

function renderIntents(
  authService: AuthService,
  callbackUrl: string | null = null
): void {
  window.history.replaceState(null, '', callbackUrl ?? INTENT_PATH)
  const jmapServer = makeFakeJmapServer()
  render(
    <AppProviders lang="en" queryClient={makeQueryClient()}>
      <AuthProvider service={authService}>
        <JmapClientProvider
          createClient={options =>
            createClient({ ...options, fetch: jmapServer.fetch })
          }
          sessionUrl={FAKE_SESSION_URL}
        >
          <IntentsApp
            page={{
              intentId: 'intent-1',
              callbackUrl:
                callbackUrl === null
                  ? null
                  : new URL(callbackUrl, window.location.origin)
            }}
          />
        </JmapClientProvider>
      </AuthProvider>
    </AppProviders>
  )
}

describe('IntentsApp', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('completes a login started by the intents page, then serves the intent', async () => {
    const authService = makeFakeOidcAuthService()
    jest.mocked(authService.handleCallback).mockResolvedValue({
      ok: true,
      value: { returnTo: INTENT_PATH }
    })

    renderIntents(authService, '/intents/callback?code=abc&state=xyz')

    // Not in a frame here: the page says the intent cannot be served
    expect(
      await screen.findByTestId('intent-error-unavailable')
    ).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe(INTENT_PATH)
  })

  it('says the session expired when the SSO needs the user, without a login form', async () => {
    const authService = makeFakeOidcAuthService({ status: 'anonymous' })
    jest.mocked(authService.handleCallback).mockResolvedValue({
      ok: false,
      error: 'login-required',
      returnTo: INTENT_PATH
    })

    renderIntents(
      authService,
      '/intents/callback?error=login_required&state=xyz'
    )

    expect(
      await screen.findByTestId('intent-error-session-expired')
    ).toHaveTextContent('Your session has expired')
    expect(window.location.pathname + window.location.search).toBe(INTENT_PATH)
    expect(authService.startLogin).not.toHaveBeenCalled()
  })

  it('serves no intent on a path under /intents without one', () => {
    window.history.replaceState(null, '', '/intents/settings')
    const jmapServer = makeFakeJmapServer()
    render(
      <AppProviders lang="en" queryClient={makeQueryClient()}>
        <AuthProvider service={makeFakeOidcAuthService()}>
          <JmapClientProvider
            createClient={options =>
              createClient({ ...options, fetch: jmapServer.fetch })
            }
            sessionUrl={FAKE_SESSION_URL}
          >
            <IntentsApp page={{ intentId: null, callbackUrl: null }} />
          </JmapClientProvider>
        </AuthProvider>
      </AppProviders>
    )

    expect(screen.getByTestId('intent-error-unavailable')).toBeInTheDocument()
  })

  it('exchanges no code when the login it comes back from is not for an intent', () => {
    const authService = makeFakeOidcAuthService({ status: 'anonymous' })
    window.history.replaceState(
      null,
      '',
      '/intents/callback?code=abc&state=xyz'
    )
    const jmapServer = makeFakeJmapServer()
    render(
      <AppProviders lang="en" queryClient={makeQueryClient()}>
        <AuthProvider service={authService}>
          <JmapClientProvider
            createClient={options =>
              createClient({ ...options, fetch: jmapServer.fetch })
            }
            sessionUrl={FAKE_SESSION_URL}
          >
            <IntentsApp
              page={{
                intentId: null,
                callbackUrl: new URL(window.location.href)
              }}
            />
          </JmapClientProvider>
        </AuthProvider>
      </AppProviders>
    )

    expect(screen.getByTestId('intent-error-unavailable')).toBeInTheDocument()
    expect(authService.handleCallback).not.toHaveBeenCalled()
  })

  it('cannot serve an intent in the basic mode, without an ID token', () => {
    renderIntents(makeFakeBasicAuthService())

    expect(screen.getByTestId('intent-error-unavailable')).toBeInTheDocument()
  })
})
