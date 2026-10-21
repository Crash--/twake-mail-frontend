import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Route } from 'react-router'

import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { resolveConfig } from '@common/config/config'
import type { AuthService } from '@common/features/auth/types'
import { FAKE_JMAP_ORIGIN } from '@common/testing/fakeJmapServer'
import {
  makeFakeBasicAuthService,
  makeFakeOidcAuthService
} from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppLayout } from './AppLayout'

jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => ({ isInIframe: () => false }))
}))

const PLATFORM = 'https://alice.twake.example.com'
const ASSISTANT_HREF = 'https://alice-assistant.twake.example.com/#/intents'

const CREATE_DRAFT = {
  type: 'function',
  function: {
    name: 'create_draft',
    description: 'Create a draft',
    parameters: {
      type: 'object',
      properties: { body: { type: 'string', description: 'The body' } },
      required: ['body']
    }
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function respond(
  url: URL,
  init: RequestInit | undefined,
  toolsStatus: number
): Response {
  if (url.href === `${FAKE_JMAP_ORIGIN}/ai/v1/tools`) {
    return jsonResponse({ tools: [CREATE_DRAFT] }, toolsStatus)
  }
  if (url.origin !== PLATFORM) return jsonResponse({}, 404)
  const attributes = (value: unknown): Response =>
    jsonResponse({ data: { id: 'doc', type: 'doc', attributes: value } })
  switch (url.pathname) {
    case '/auth/token_exchange':
      return jsonResponse({
        access_token: 'platform-access',
        refresh_token: 'platform-refresh',
        client_id: 'client',
        client_secret: 'secret'
      })
    case '/intents':
      return jsonResponse({
        data: {
          id: 'intent-1',
          type: 'io.cozy.intents',
          attributes: {
            action: 'OPEN',
            type: 'io.cozy.ai.chat.conversations',
            services: [{ href: ASSISTANT_HREF }]
          }
        }
      })
    case '/settings/instance':
      return attributes({ email: 'alice@example.com' })
    case '/settings/context':
    case '/settings/flags':
      return attributes({})
    case '/apps/':
      return jsonResponse({ data: [] })
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

function mockServers(toolsStatus = 200): FetchMock {
  const fetchMock: FetchMock = jest.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(respond(new URL(requestUrl(input)), init, toolsStatus))
  )
  globalThis.fetch = fetchMock
  return fetchMock
}

function calledUrls(fetchMock: FetchMock): string[] {
  return fetchMock.mock.calls.map(([input]) => requestUrl(input))
}

function withConfig(ui: ReactElement): ReactElement {
  const result = resolveConfig(
    {
      SERVER_URL: FAKE_JMAP_ORIGIN,
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

function renderLayout(
  authService: AuthService = makeFakeOidcAuthService({
    status: 'authenticated',
    user: {
      email: 'alice@example.com',
      name: 'Alice Martin',
      workplaceFqdn: 'alice.twake.example.com'
    }
  })
): void {
  renderWithProviders(withConfig(<AppLayout />), {
    authService,
    withJmapSession: true,
    childRoutes: <Route index element={<p>Routed content</p>} />
  })
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('AppLayout with the assistant', () => {
  it('opens the assistant beside the mail, with the tools of tmail-backend', async () => {
    const fetchMock = mockServers()
    renderLayout()

    const button = await screen.findByRole('button', { name: 'AI assistant' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)

    const panel = screen.getByRole('complementary', { name: 'Assistant' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(await within(panel).findByTitle('Twake Assistant')).toHaveAttribute(
      'src',
      ASSISTANT_HREF
    )
    expect(calledUrls(fetchMock)).toEqual(
      expect.arrayContaining([
        `${FAKE_JMAP_ORIGIN}/ai/v1/tools`,
        `${PLATFORM}/intents`
      ])
    )
    expect(screen.getByText('Routed content')).toBeVisible()
  })

  it('opens the assistant without tools when tmail-backend refuses them', async () => {
    mockServers(401)
    renderLayout()

    await userEvent.click(
      await screen.findByRole('button', { name: 'AI assistant' })
    )

    expect(
      await within(
        screen.getByRole('complementary', { name: 'Assistant' })
      ).findByTitle('Twake Assistant')
    ).toHaveAttribute('src', ASSISTANT_HREF)
  })

  it('closes from its button, which gets the focus back', async () => {
    mockServers()
    renderLayout()
    const button = await screen.findByRole('button', { name: 'AI assistant' })
    await userEvent.click(button)
    await within(
      screen.getByRole('complementary', { name: 'Assistant' })
    ).findByTitle('Twake Assistant')

    await userEvent.click(button)

    expect(screen.queryByRole('complementary', { name: 'Assistant' })).toBe(
      null
    )
    await waitFor(() => {
      expect(button).toHaveFocus()
    })
  })

  it('is not offered without the platform, in basic mode', async () => {
    mockServers()
    renderLayout(makeFakeBasicAuthService())

    expect(await screen.findByText('Routed content')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'AI assistant' })).toBe(null)
  })
})
