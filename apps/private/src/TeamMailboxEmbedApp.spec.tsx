import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createClient } from 'jmap-client-ts'

import { sentryLifecycle } from '@common/app/sentry'
import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import type { AuthService } from '@common/features/auth/types'
import { LoadingAnnouncer } from '@common/features/loading/LoadingAnnouncer'
import type {
  SpaceBridge,
  SpaceNavigation
} from '@common/features/teamMailboxEmbed/spaceBridge'
import { parseTeamMailboxEmbedPath } from '@common/features/teamMailboxEmbed/teamMailboxEmbedPath'
import { JmapClientProvider } from '@common/jmap/JmapClientProvider'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import {
  FAKE_SESSION_URL,
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  makeFakeBasicAuthService,
  makeFakeOidcAuthService
} from '@common/testing/makeFakeAuthService'

import { TeamMailboxEmbedApp } from './TeamMailboxEmbedApp'

const BASE = '/embed/team-mailboxes/team'
const ANONYMOUS = { status: 'anonymous' } as const

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      ...makeTeamMailboxes({ id: 'team', address: 'team@example.com' }),
      ...makeTeamMailboxes({ id: 'sales', address: 'sales@example.com' })
    ]
  })
}

function makeSpaceBridge(): SpaceBridge & {
  syncHistory: jest.Mock<() => void, [SpaceNavigation]>
  notifyLoginRequired: jest.Mock
  reportBadges: jest.Mock
} {
  return {
    syncHistory: jest.fn((_apply: SpaceNavigation) => () => undefined),
    notifyLoginRequired: jest.fn(),
    reportBadges: jest.fn()
  }
}

interface RenderEmbedOptions {
  authService?: AuthService
  jmapServer?: FakeJmapServer
  /** The SSO came back with this URL for a login of the facade */
  callbackUrl?: string
  spaceBridge?: SpaceBridge | null
}

function renderEmbed(
  path: string,
  {
    authService = makeFakeBasicAuthService(),
    jmapServer = makeServer(),
    callbackUrl,
    spaceBridge = null
  }: RenderEmbedOptions = {}
): void {
  window.history.replaceState(null, '', callbackUrl ?? path)
  const target = parseTeamMailboxEmbedPath(path)
  if (target === null) throw new Error(`Not a path of the facade: ${path}`)
  const queryClient = makeQueryClient()
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false }
  })

  render(
    <AppProviders lang="en" queryClient={queryClient}>
      <AuthProvider service={authService}>
        <JmapClientProvider
          createClient={options =>
            createClient({ ...options, fetch: jmapServer.fetch })
          }
          sessionUrl={FAKE_SESSION_URL}
        >
          <LoadingAnnouncer>
            <TeamMailboxEmbedApp
              embed={{
                target,
                callbackUrl:
                  callbackUrl === undefined
                    ? null
                    : new URL(callbackUrl, window.location.origin)
              }}
              spaceBridge={spaceBridge}
            />
          </LoadingAnnouncer>
        </JmapClientProvider>
      </AuthProvider>
    </AppProviders>
  )
}

// The redirections of the facade are in TeamMailboxEmbedRoutes.spec: a
// data router cannot navigate in jsdom (its AbortSignal is not the one of
// Node's Request)
describe('TeamMailboxEmbedApp', () => {
  listEmailsOneByOne()

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('never shows the feedback button, even with the reporting and its feedback running: TwakeSpace has its own', async () => {
    jest.spyOn(sentryLifecycle, 'isFeedbackRunning').mockReturnValue(true)
    jest.spyOn(sentryLifecycle, 'feedbackGeneration').mockReturnValue(1)
    jest.spyOn(sentryLifecycle, 'isRunning').mockReturnValue(true)
    renderEmbed(`${BASE}/mailbox/team-sent`)

    expect(await screen.findByTestId('mailbox-page')).toBeVisible()
    expect(screen.queryByTestId('twake-feedback-button')).toBe(null)
  })

  it('comes back to the facade after the SSO', () => {
    const authService = makeFakeOidcAuthService(ANONYMOUS)
    renderEmbed(`${BASE}/mailbox/team-sent?page=2`, { authService })

    expect(authService.startLogin).toHaveBeenCalledWith(
      `${BASE}/mailbox/team-sent?page=2`
    )
  })

  it('shows the rows of a list, not a spinner, while the user signs in', async () => {
    renderEmbed(`${BASE}/mailbox/team-sent`, {
      authService: makeFakeOidcAuthService(ANONYMOUS)
    })

    expect(await screen.findByTestId('email-list-loading')).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByTestId('loading-announcement')).toHaveTextContent(
      'Loading'
    )
    expect(screen.queryByTestId('full-page-loader')).toBe(null)
  })

  it('shows the rows of a list while the login callback completes', async () => {
    const authService = makeFakeOidcAuthService()
    authService.handleCallback = jest.fn(
      () => new Promise<never>(() => undefined)
    )
    renderEmbed(`${BASE}/mailbox/team-sent`, {
      authService,
      callbackUrl: '/callback?code=abc&state=s1'
    })

    expect(await screen.findByTestId('email-list-loading')).toBeVisible()
    expect(screen.queryByTestId('full-page-loader')).toBe(null)
  })

  it('completes a login started by the facade, then shows the page it was for', async () => {
    const authService = makeFakeOidcAuthService()
    authService.handleCallback = jest.fn(() =>
      Promise.resolve({
        ok: true as const,
        value: { returnTo: `${BASE}/mailbox/team-sent` }
      })
    )
    renderEmbed(`${BASE}/mailbox/team-sent`, {
      authService,
      callbackUrl: '/callback?code=abc&state=s1'
    })

    expect(await screen.findByTestId('mailbox-page')).toHaveAttribute(
      'data-mailbox-id',
      'team-sent'
    )
    expect(authService.handleCallback).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe(`${BASE}/mailbox/team-sent`)
  })

  it('tells TwakeSpace the unread emails of every team mailbox of the user', async () => {
    const spaceBridge = makeSpaceBridge()
    renderEmbed(`${BASE}/mailbox/team-inbox`, { spaceBridge })

    await waitFor(() => {
      expect(spaceBridge.reportBadges).toHaveBeenCalledWith([
        { resourceId: 'team', count: 0 },
        { resourceId: 'sales', count: 0 }
      ])
    })
  })

  it('shows the mailbox TwakeSpace loads in the same document, its badges kept', async () => {
    const spaceBridge = makeSpaceBridge()
    renderEmbed(`${BASE}/mailbox/team-inbox`, { spaceBridge })
    expect(await screen.findByTestId('mailbox-page')).toHaveAttribute(
      'data-mailbox-id',
      'team-inbox'
    )
    await waitFor(() => {
      expect(spaceBridge.reportBadges).toHaveBeenCalled()
    })
    const apply = spaceBridge.syncHistory.mock.calls[0]?.[0]
    if (apply === undefined) throw new Error('The history is not synced')

    act(() => {
      window.history.replaceState(
        null,
        '',
        '/embed/team-mailboxes/sales/mailbox/sales-inbox'
      )
      apply.load({ basename: '/embed/team-mailboxes/sales', rootId: 'sales' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('mailbox-page')).toHaveAttribute(
        'data-mailbox-id',
        'sales-inbox'
      )
    })
    expect(screen.queryByTestId('email-list-loading')).toBe(null)
  })

  it('asks TwakeSpace to sign the user in again when the session expired', async () => {
    const authService = makeFakeOidcAuthService(ANONYMOUS)
    authService.handleCallback = jest.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: 'login-required' as const,
        returnTo: `${BASE}/mailbox/team-sent`
      })
    )
    const spaceBridge = makeSpaceBridge()
    renderEmbed(`${BASE}/mailbox/team-sent`, {
      authService,
      callbackUrl: '/callback?error=login_required&state=s1',
      spaceBridge
    })

    const expired = await screen.findByTestId('team-mailbox-session-expired')
    // On the pane of the facade, not on the background of the page
    expect(expired.closest('.u-pt-1')).not.toBe(null)
    expect(spaceBridge.notifyLoginRequired).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe(`${BASE}/mailbox/team-sent`)
    // No silent login again until asked: it would fail the same way
    expect(authService.startLogin).not.toHaveBeenCalled()

    await userEvent.click(
      screen.getByTestId('team-mailbox-session-expired-action')
    )

    expect(authService.startLogin).toHaveBeenCalledWith(
      `${BASE}/mailbox/team-sent`
    )
  })
})
