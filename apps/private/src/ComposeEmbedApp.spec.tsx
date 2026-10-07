import { render, screen, waitFor } from '@testing-library/react'
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
import { makeFakeOidcAuthService } from '@common/testing/makeFakeAuthService'

import { ComposeEmbedApp } from './ComposeEmbedApp'

const ANONYMOUS = { status: 'anonymous' } as const
const LINK = '/embed/compose?uri=mailto%3Abob%40example.com'

function renderCompose(
  authService: AuthService,
  callbackUrl: string | null = null
): void {
  window.history.replaceState(null, '', callbackUrl ?? LINK)
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
          <ComposeEmbedApp
            callbackUrl={
              callbackUrl === null
                ? null
                : new URL(callbackUrl, window.location.origin)
            }
          />
        </JmapClientProvider>
      </AuthProvider>
    </AppProviders>
  )
}

describe('ComposeEmbedApp', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
    jest.restoreAllMocks()
  })

  it('signs in silently, coming back to the link', () => {
    const authService = makeFakeOidcAuthService(ANONYMOUS)
    renderCompose(authService)

    expect(authService.startLogin).toHaveBeenCalledWith(LINK)
  })

  it('opens a composer to the address of the link', async () => {
    renderCompose(makeFakeOidcAuthService())

    expect(
      await screen.findByText('bob@example.com', {}, { timeout: 5_000 })
    ).toBeInTheDocument()
  })

  it('tells the framing page when the SSO needs the user', async () => {
    const post = jest.spyOn(window.parent, 'postMessage')
    const authService = makeFakeOidcAuthService(ANONYMOUS)
    authService.handleCallback = jest.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: 'login-required' as const,
        returnTo: LINK
      })
    )
    renderCompose(authService, '/callback?error=login_required&state=s1')

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        { type: 'twake-embed:login-required' },
        '*'
      )
    })
  })
})
