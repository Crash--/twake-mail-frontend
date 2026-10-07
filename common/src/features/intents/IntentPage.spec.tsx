import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { IntentService, IntentsFetch } from 'cozy-interapp'

import { resolveConfig, type AppConfig } from '@common/config/config'
import { makeFakeOidcAuthService } from '@common/testing/makeFakeAuthService'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { clearComposerStorage } from '@common/features/composer/composerStorage'

import { IntentPage } from './IntentPage'
import { CozyStackError } from './intentsFetch'
import { CLIENT_ANSWER_TIMEOUT_MS } from './useIntentService'

const STACK = 'https://alice.twake.example.com'

interface FakeIntents {
  fetch: IntentsFetch | null
  service: IntentService & {
    terminate: jest.Mock
    cancel: jest.Mock
    throw: jest.Mock
    notifyReadyToUse: jest.Mock
    hideCross: jest.Mock
  }
  createService: jest.Mock
}

const fake: FakeIntents = {
  fetch: null,
  service: makeService('CREATE', 'io.cozy.mails', null),
  createService: jest.fn()
}

const CHAT = 'https://chat.example.com'

function makeService(
  action: string,
  type: string,
  data: unknown,
  /** The origins the stack allows to frame the service; absent before it gave them */
  frameAncestors?: string[]
): FakeIntents['service'] {
  return {
    getIntent: () => ({
      _id: 'intent-1',
      attributes: { action, type, client: CHAT, frameAncestors }
    }),
    getData: () => data,
    terminate: jest.fn(),
    cancel: jest.fn(),
    throw: jest.fn(),
    notifyReadyToUse: jest.fn(),
    hideCross: jest.fn(),
    showCross: jest.fn()
  }
}

// The boundary: the protocol with the client app is cozy-interapp's
jest.mock('cozy-interapp', () => ({
  Intents: jest
    .fn()
    .mockImplementation(({ fetch }: { fetch: IntentsFetch }) => {
      fake.fetch = fetch
      return { createService: fake.createService }
    })
}))

// The saves are tested with the real delay in draftPolicy.spec.tsx
jest.mock('@common/features/composer/draftPolicy', () => ({
  LOCAL_SAVE_DELAY_MS: 800,
  DRAFT_IDLE_MS: 1500
}))

function makeConfig(): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      SSO_BASE_URL: 'https://sso.example.com',
      WEB_OIDC_CLIENT_ID: 'twake-mail',
      TDRIVE_INTENT_URL: 'https://{localpart}.twake.example.com'
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error('Invalid configuration')
  return result.value
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()
const originalFetch = global.fetch

function renderIntent(
  service: FakeIntents['service'] = fake.service
): ReturnType<typeof renderWithProviders> {
  fake.service = service
  fake.createService.mockResolvedValue(service)
  return renderWithProviders(<IntentPage intentId="intent-1" />, {
    authService: makeFakeOidcAuthService(),
    jmapServer: makeFakeJmapServer(),
    withJmapSession: true,
    config: makeConfig()
  })
}

describe('IntentPage', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(input =>
      Promise.resolve(
        urlOf(input) === `${STACK}/auth/token_exchange`
          ? json({ access_token: 'stack-token' })
          : json({ errors: [] }, 404)
      )
    )
    global.fetch = fetchMock
    // In the frame of the client app
    jest.spyOn(window, 'parent', 'get').mockReturnValue({} as Window)
    fake.createService.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
    void clearComposerStorage()
  })

  it('opens the new message the client asks for, in the frame', async () => {
    renderIntent(
      makeService('CREATE', 'io.cozy.mails', {
        to: ['bob@example.com'],
        subject: 'Lunch'
      })
    )

    expect(await screen.findByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Lunch'
    )
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(fake.createService).toHaveBeenCalledWith('intent-1', window)
    await waitFor(() => {
      expect(fake.service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    })
    expect(fake.service.hideCross).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `${STACK}/auth/token_exchange`,
      expect.objectContaining({
        body: JSON.stringify({
          id_token: 'id-token-alice',
          exchange_type: 'app'
        })
      })
    )
  })

  it('reads the intent from the stack with the token of the stack', async () => {
    renderIntent()
    await screen.findByTestId('compose-intent')

    await fake.fetch?.('GET', '/intents/intent-1').catch(() => null)

    expect(fetchMock).toHaveBeenCalledWith(
      `${STACK}/intents/intent-1`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stack-token'
        })
      })
    )
  })

  it('tells the client the message was sent', async () => {
    renderIntent(
      makeService('CREATE', 'io.cozy.mails', {
        to: ['bob@example.com'],
        subject: 'Lunch'
      })
    )
    const composer = await screen.findByTestId('compose-intent')

    await userEvent.click(
      await within(composer).findByRole('button', { name: 'Send' })
    )

    await waitFor(() => {
      expect(fake.service.terminate).toHaveBeenCalledWith({ status: 'sent' })
    })
    expect(fake.service.cancel).not.toHaveBeenCalled()
  })

  it('shows no composer while the client has not answered the handshake', async () => {
    fake.createService.mockReturnValue(new Promise<never>(() => undefined))
    renderWithProviders(<IntentPage intentId="intent-1" />, {
      authService: makeFakeOidcAuthService(),
      withJmapSession: true,
      config: makeConfig()
    })

    await waitFor(() => {
      expect(fake.createService).toHaveBeenCalled()
    })
    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument()
    expect(screen.queryByTestId('compose-intent')).toBe(null)
  })

  it('gives up when the client never answers the handshake', async () => {
    jest.useFakeTimers()
    try {
      fake.createService.mockReturnValue(new Promise<never>(() => undefined))
      renderWithProviders(<IntentPage intentId="intent-1" />, {
        authService: makeFakeOidcAuthService(),
        withJmapSession: true,
        config: makeConfig()
      })
      await waitFor(() => {
        expect(fake.createService).toHaveBeenCalled()
      })

      await act(async () => {
        await jest.advanceTimersByTimeAsync(CLIENT_ANSWER_TIMEOUT_MS)
      })

      expect(screen.getByTestId('intent-error-failed')).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  it('cancels the intent when the user deletes the draft', async () => {
    renderIntent()
    await screen.findByRole('textbox', { name: 'Subject' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete draft' }))

    await waitFor(() => {
      expect(fake.service.cancel).toHaveBeenCalledTimes(1)
    })
    expect(fake.service.terminate).not.toHaveBeenCalled()
  })

  it('cancels the intent when the user closes an untouched message', async () => {
    renderIntent()
    await screen.findByRole('textbox', { name: 'Subject' })

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(fake.service.cancel).toHaveBeenCalledTimes(1)
    })
    expect(fake.service.terminate).not.toHaveBeenCalled()
  })

  it('gives the draft to the client when the user saves it on closing', async () => {
    renderIntent()
    await userEvent.click(
      await screen.findByRole('textbox', { name: 'Subject' })
    )
    await userEvent.paste('Notes')

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(fake.service.terminate).toHaveBeenCalledWith({
        status: 'draft',
        draftId: expect.any(String)
      })
    })
  })

  it('fails an intent Twake Mail does not serve', async () => {
    renderIntent(makeService('PICK', 'io.cozy.files', null))

    expect(
      await screen.findByTestId('intent-error-unsupported')
    ).toHaveTextContent('Twake Mail cannot do this')
    expect(fake.service.throw).toHaveBeenCalledTimes(1)
  })

  it('fails a new message of another shape', async () => {
    renderIntent(
      makeService('CREATE', 'io.cozy.mails', { to: 'bob@example.com' })
    )

    expect(
      await screen.findByTestId('intent-error-invalid-data')
    ).toBeInTheDocument()
    expect(fake.service.throw).toHaveBeenCalledTimes(1)
  })

  it('says the stack does not let Twake Mail read the intent', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    renderIntent()
    fake.createService.mockRejectedValue(new CozyStackError(403))

    expect(
      await screen.findByTestId('intent-error-forbidden')
    ).toBeInTheDocument()
  })

  describe('who frames the page', () => {
    function setAncestorOrigins(origins: string[]): void {
      Object.defineProperty(window.location, 'ancestorOrigins', {
        value: origins,
        configurable: true
      })
    }

    afterEach(() => {
      Reflect.deleteProperty(window.location, 'ancestorOrigins')
    })

    it('serves the intent when only the client app frames it', async () => {
      setAncestorOrigins([CHAT])
      renderIntent(makeService('CREATE', 'io.cozy.mails', null, [CHAT]))

      expect(await screen.findByTestId('compose-intent')).toBeInTheDocument()
      expect(fake.service.cancel).not.toHaveBeenCalled()
    })

    it('cancels the intent when an unknown page frames the client app', async () => {
      setAncestorOrigins([CHAT, 'https://evil.example'])
      renderIntent(makeService('CREATE', 'io.cozy.mails', null, [CHAT]))

      expect(
        await screen.findByTestId('intent-error-untrusted-frame')
      ).toBeInTheDocument()
      expect(fake.service.cancel).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('compose-intent')).toBe(null)
    })

    it('relies on the handshake when the stack does not give the origins', async () => {
      setAncestorOrigins([CHAT, 'https://evil.example'])
      renderIntent(makeService('CREATE', 'io.cozy.mails', null))

      expect(await screen.findByTestId('compose-intent')).toBeInTheDocument()
    })

    it('relies on the handshake when the browser does not tell the ancestors', async () => {
      renderIntent(makeService('CREATE', 'io.cozy.mails', null, [CHAT]))

      expect(await screen.findByTestId('compose-intent')).toBeInTheDocument()
    })
  })

  it('says it cannot open outside a frame', async () => {
    jest.spyOn(window, 'parent', 'get').mockReturnValue(window)
    renderIntent()

    expect(
      await screen.findByTestId('intent-error-unavailable')
    ).toBeInTheDocument()
    expect(fake.createService).not.toHaveBeenCalled()
  })

  it('says it cannot open when the stack refuses the token', async () => {
    fetchMock.mockResolvedValue(json({ error: 'invalid_token' }, 400))
    renderIntent()

    expect(
      await screen.findByTestId('intent-error-unavailable')
    ).toBeInTheDocument()
    expect(fake.createService).not.toHaveBeenCalled()
  })
})
