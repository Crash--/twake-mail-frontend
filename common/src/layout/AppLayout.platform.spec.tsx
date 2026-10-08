import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Route } from 'react-router'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { resolveConfig } from '@common/config/config'
import type { AuthService } from '@common/features/auth/types'
import {
  makeFakeBasicAuthService,
  makeFakeOidcAuthService
} from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppLayout } from './AppLayout'

const mockIsInIframe = jest.fn<boolean, []>()

jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => ({ isInIframe: mockIsInIframe }))
}))

const PLATFORM = 'https://alice.twake.example.com'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

/** The cozy-stack of Alice, as the platform client asks it */
function platformResponse(
  url: URL,
  init: RequestInit | undefined,
  isExchangeAccepted: boolean
): Response {
  if (url.pathname === '/auth/token_exchange') {
    return isExchangeAccepted
      ? jsonResponse({
          access_token: 'platform-access',
          refresh_token: 'platform-refresh',
          client_id: 'client',
          client_secret: 'secret'
        })
      : jsonResponse({ error: 'invalid id token' }, 403)
  }
  const attributes = (value: unknown): Response =>
    jsonResponse({ data: { id: 'doc', type: 'doc', attributes: value } })
  switch (url.pathname) {
    case '/settings/instance':
      return attributes({
        email: 'alice@example.com',
        public_name: 'Alice Martin'
      })
    case '/settings/context':
    case '/settings/flags':
      return attributes({})
    case '/apps/':
      return jsonResponse({
        data: [
          {
            id: 'io.cozy.apps/home',
            type: 'io.cozy.apps',
            attributes: { slug: 'home', name: 'Home', state: 'ready' },
            links: { related: 'https://alice-home.twake.example.com/' }
          },
          {
            id: 'io.cozy.apps/drive',
            type: 'io.cozy.apps',
            attributes: { slug: 'drive', name: 'Drive', state: 'ready' },
            links: { related: 'https://alice-drive.twake.example.com/' }
          }
        ]
      })
    default:
      return jsonResponse({ errors: [] }, init?.method === 'POST' ? 403 : 404)
  }
}

type FetchMock = jest.Mock<
  Promise<Response>,
  [input: RequestInfo | URL, init?: RequestInit]
>

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url
  return input instanceof URL ? input.href : input
}

function mockPlatform(isExchangeAccepted = true): FetchMock {
  const fetchMock: FetchMock = jest.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(requestUrl(input))
      // The ecosystem document of the server, for error reporting
      if (url.origin !== PLATFORM) return Promise.resolve(jsonResponse({}, 404))
      return Promise.resolve(platformResponse(url, init, isExchangeAccepted))
    }
  )
  globalThis.fetch = fetchMock
  return fetchMock
}

function platformRequests(fetchMock: FetchMock): string[] {
  return fetchMock.mock.calls
    .map(([input]) => requestUrl(input))
    .filter(url => url.startsWith(PLATFORM))
}

function withConfig(ui: ReactElement): ReactElement {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'oidc',
      SSO_BASE_URL: 'https://sso.example.com',
      WEB_OIDC_CLIENT_ID: 'twake-mail',
      WORKPLACE_EMBEDDING: true
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error('Invalid configuration')
  return <AppConfigProvider config={result.value}>{ui}</AppConfigProvider>
}

const oidcService = (
  workplaceFqdn: string | null = 'alice.twake.example.com'
): AuthService =>
  makeFakeOidcAuthService({
    status: 'authenticated',
    user: { email: 'alice@example.com', name: 'Alice Martin', workplaceFqdn }
  })

function renderLayout({
  authService = oidcService(),
  route = '/'
}: {
  authService?: AuthService
  route?: string
} = {}): void {
  renderWithProviders(withConfig(<AppLayout />), {
    route,
    path: '*',
    authService,
    withJmapSession: true,
    childRoutes: (
      <>
        <Route index element={<p>Routed content</p>} />
        <Route path="mailbox/:mailboxId" element={<p>Folder content</p>} />
        <Route path="settings/*" element={<p>Settings content</p>} />
      </>
    )
  })
}

const originalFetch = globalThis.fetch

describe('AppLayout with the platform bar', () => {
  beforeEach(() => {
    mockIsInIframe.mockReturnValue(false)
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    resetViewport()
  })

  it('exchanges the ID token and shows the menus of the platform', async () => {
    const fetchMock = mockPlatform()
    renderLayout()

    const bar = await screen.findByTestId('twake-bar')
    expect(
      await within(bar).findByRole('button', { name: 'Account' })
    ).toBeEnabled()
    expect(within(bar).getByRole('img', { name: 'Twake Mail' })).toBeVisible()
    expect(within(bar).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      'https://alice-home.twake.example.com/'
    )
    expect(
      within(bar).getByRole('button', { name: 'Applications' })
    ).toBeVisible()
    expect(within(bar).queryByTestId('logout-button')).toBe(null)
    expect(screen.queryByTestId('top-bar')).toBe(null)
    // With the platform its bar stays as in every app of the platform: the
    // settings stay in the page, next to the search
    expect(
      within(screen.getByTestId('search-row')).getByRole('button', {
        name: 'Settings'
      })
    ).toBeVisible()

    const exchange = fetchMock.mock.calls.find(
      ([input]) => requestUrl(input) === `${PLATFORM}/auth/token_exchange`
    )
    expect(exchange?.[1]?.body).toBe(
      JSON.stringify({ id_token: 'id-token-alice', exchange_type: 'app' })
    )
  })

  it('lists the apps of the platform', async () => {
    mockPlatform()
    renderLayout()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Applications' })
    )

    expect(await screen.findByTitle('Drive')).toHaveAttribute(
      'href',
      'https://alice-drive.twake.example.com/'
    )
  })

  it('signs out of the app from the account menu of the platform', async () => {
    mockPlatform()
    const authService = oidcService()
    renderLayout({ authService })

    const account = await screen.findByRole('button', { name: 'Account' })
    await waitFor(() => {
      expect(account).toBeEnabled()
    })
    await userEvent.click(account)
    expect(await screen.findByText('Alice Martin')).toBeVisible()
    await userEvent.click(screen.getByTestId('twake-bar-logout'))

    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps the bar of the mail under it below the desktop size, with the folders and a gear', async () => {
    mockViewport({ width: 390, touch: true })
    mockPlatform()
    renderLayout({ route: '/mailbox/mailbox-inbox' })

    expect(await screen.findByTestId('twake-bar')).toBeVisible()
    const topBar = screen.getByTestId('top-bar')
    expect(
      await within(topBar).findByTestId('top-bar-folder-name')
    ).toHaveTextContent('Inbox')
    expect(
      within(topBar).getByRole('button', { name: 'Show folders' })
    ).toBeVisible()

    await userEvent.click(
      within(topBar).getByRole('button', { name: 'Settings' })
    )
    expect(await screen.findByText('Settings content')).toBeVisible()
  })

  it('keeps the bar, with a log out button, when the platform refuses the token', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    mockPlatform(false)
    const authService = oidcService()
    renderLayout({ authService })

    const bar = await screen.findByTestId('twake-bar')
    await waitFor(() => {
      expect(bar).toHaveAttribute('data-status', 'public')
    })
    expect(within(bar).queryByRole('button', { name: 'Account' })).toBe(null)
    await userEvent.click(within(bar).getByTestId('logout-button'))

    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalledTimes(1)
    })
  })

  it('asks no platform when the SSO names no workplace', async () => {
    const fetchMock = mockPlatform()
    renderLayout({ authService: oidcService(null) })

    const bar = await screen.findByTestId('twake-bar')
    expect(bar).toHaveAttribute('data-status', 'public')
    expect(within(bar).getByTestId('logout-button')).toBeVisible()
    expect(platformRequests(fetchMock)).toEqual([])
  })

  it('asks no platform in basic mode, which has no ID token', async () => {
    const fetchMock = mockPlatform()
    renderLayout({ authService: makeFakeBasicAuthService() })

    expect(await screen.findByTestId('twake-bar')).toHaveAttribute(
      'data-status',
      'public'
    )
    expect(platformRequests(fetchMock)).toEqual([])
  })

  it('leaves the bar to Twake Workplace when it frames the app', async () => {
    mockIsInIframe.mockReturnValue(true)
    const fetchMock = mockPlatform()
    renderLayout()

    expect(await screen.findByTestId('search-row')).toBeVisible()
    expect(screen.queryByTestId('twake-bar')).toBe(null)
    expect(screen.queryByRole('img', { name: 'Twake Mail' })).toBe(null)
    expect(
      within(screen.getByTestId('search-row')).getByRole('button', {
        name: 'Settings'
      })
    ).toBeVisible()
    expect(platformRequests(fetchMock)).toEqual([])
  })
})
