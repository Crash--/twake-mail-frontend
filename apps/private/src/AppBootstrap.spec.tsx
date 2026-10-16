import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  completeConfig,
  type CompleteConfigResult
} from '@common/config/completeConfig'
import { resolveConfig, type AppConfig } from '@common/config/config'

import { AppBootstrap } from './AppBootstrap'
import type { IntentsPage } from './IntentsApp'
import type { TeamMailboxEmbed } from './TeamMailboxEmbedApp'

jest.mock('./App', () => ({
  App: ({
    config,
    embed,
    intents
  }: {
    config: AppConfig
    embed: TeamMailboxEmbed | null
    intents: IntentsPage | null
  }) => (
    <div data-testid="app">
      {config.authMode} mode
      {embed === null ? '' : `, team mailbox ${embed.target.rootId}`}
      {intents === null
        ? ''
        : `, intent ${intents.intentId ?? 'none'}${intents.callbackUrl === null ? '' : ' after the SSO'}`}
    </div>
  )
}))
jest.mock('@common/config/completeConfig')

const completeConfigMock = jest.mocked(completeConfig)

function completed(value: AppConfig): CompleteConfigResult {
  return { ok: true, value }
}

function makeOidcConfig(): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      SSO_BASE_URL: 'https://sso.example.com',
      WEB_OIDC_CLIENT_ID: 'twake-mail'
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error(result.errors.join(', '))
  return result.value
}

function makeConfig(): AppConfig {
  const result = resolveConfig(
    { SERVER_URL: 'https://jmap.example.com', AUTH_MODE: 'basic' },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error(result.errors.join(', '))
  return result.value
}

describe('AppBootstrap', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('shows a progress indicator, then the app with the completed configuration', async () => {
    const config = makeConfig()
    completeConfigMock.mockResolvedValue(
      completed({ ...config, authMode: 'oidc' })
    )

    render(<AppBootstrap config={config} />)

    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument()
    expect(await screen.findByTestId('app')).toHaveTextContent('oidc mode')
    expect(screen.queryByTestId('full-page-loader')).toBe(null)
  })

  it('announces the boot in the one "Loading" live region of the page, kept into the app', async () => {
    completeConfigMock.mockResolvedValue(completed(makeConfig()))

    render(<AppBootstrap config={makeConfig()} />)

    const region = screen.getByTestId('loading-announcement')
    expect(region).toHaveTextContent('Loading')
    await screen.findByTestId('app')
    expect(screen.getAllByTestId('loading-announcement')).toEqual([region])
    await waitFor(() => expect(region).toBeEmptyDOMElement())
  })

  it('shows the rows of a list at once, not a spinner, on the facade of a team mailbox', () => {
    window.history.replaceState(null, '', '/embed/team-mailboxes/team-root')
    completeConfigMock.mockReturnValue(new Promise<never>(() => undefined))

    render(<AppBootstrap config={makeConfig()} />)

    expect(screen.getByTestId('email-list-loading')).toBeVisible()
    expect(screen.queryByTestId('full-page-loader')).toBe(null)
  })

  it('starts the facade with the team mailbox it found before completing the configuration', async () => {
    window.history.replaceState(null, '', '/embed/team-mailboxes/team-root')
    completeConfigMock.mockResolvedValue(completed(makeConfig()))

    render(<AppBootstrap config={makeConfig()} />)

    expect(await screen.findByTestId('app')).toHaveTextContent(
      'team mailbox team-root'
    )
  })

  it('starts the intents page with the intent of its address', async () => {
    window.history.replaceState(null, '', '/intents?intent=intent-1')
    completeConfigMock.mockResolvedValue(completed(makeConfig()))

    render(<AppBootstrap config={makeConfig()} />)

    expect(await screen.findByTestId('app')).toHaveTextContent(
      'intent intent-1'
    )
  })

  it('brings the login callback of the intents page back to it', async () => {
    const config = makeOidcConfig()
    window.sessionStorage.setItem(
      // The login twake-oidc leaves pending during the SSO round trip
      'redirectState',
      JSON.stringify({
        code_verifier: 'verifier',
        state: 'state',
        returnTo: '/intents?intent=intent-1',
        silent: true
      })
    )
    window.history.replaceState(
      null,
      '',
      '/intents/callback?code=c&state=state'
    )
    completeConfigMock.mockResolvedValue(completed(config))

    render(<AppBootstrap config={config} />)

    expect(await screen.findByTestId('app')).toHaveTextContent(
      'intent intent-1 after the SSO'
    )
    window.sessionStorage.clear()
  })

  it('serves no intent when the login of its callback was for another page', async () => {
    const config = makeOidcConfig()
    window.sessionStorage.setItem(
      // The login twake-oidc leaves pending during the SSO round trip
      'redirectState',
      JSON.stringify({
        code_verifier: 'verifier',
        state: 'state',
        returnTo: '/mailbox/inbox'
      })
    )
    window.history.replaceState(
      null,
      '',
      '/intents/callback?code=c&state=state'
    )
    completeConfigMock.mockResolvedValue(completed(config))

    render(<AppBootstrap config={config} />)

    expect(await screen.findByTestId('app')).toHaveTextContent(
      'intent none after the SSO'
    )
    window.sessionStorage.clear()
  })

  it('never starts the webmail under /intents, where other apps may frame it', async () => {
    window.history.replaceState(null, '', '/intents/settings')
    completeConfigMock.mockResolvedValue(completed(makeConfig()))

    render(<AppBootstrap config={makeConfig()} />)

    expect(await screen.findByTestId('app')).toHaveTextContent('intent none')
  })

  it('offers a retry when the SSO cannot be reached, then starts the app', async () => {
    const config = makeConfig()
    completeConfigMock
      .mockResolvedValueOnce({ ok: false, error: 'sso-unreachable' })
      .mockResolvedValueOnce({
        ok: true,
        value: { ...config, authMode: 'oidc' }
      })

    render(<AppBootstrap config={config} />)

    expect(await screen.findByTestId('sso-unreachable')).toHaveTextContent(
      'Cannot reach the sign-in service'
    )
    expect(screen.queryByTestId('app')).toBe(null)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('app')).toHaveTextContent('oidc mode')
    expect(screen.queryByTestId('sso-unreachable')).toBe(null)
    expect(completeConfigMock).toHaveBeenCalledTimes(2)
  })

  it('names the page and focuses Retry, which keeps the focus through a failed retry', async () => {
    completeConfigMock.mockResolvedValue({
      ok: false,
      error: 'sso-unreachable'
    })

    render(<AppBootstrap config={makeConfig()} />)

    const retry = await screen.findByRole('button', { name: 'Retry' })
    expect(retry).toHaveFocus()
    expect(document.title).toBe('Cannot reach the sign-in service - Twake Mail')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(completeConfigMock).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus()
  })

  it('keeps the error screen while a retry runs, a second click starting none', async () => {
    const config = makeConfig()
    let finishRetry: (result: CompleteConfigResult) => void = () => undefined
    completeConfigMock
      .mockResolvedValueOnce({ ok: false, error: 'sso-unreachable' })
      .mockReturnValueOnce(
        new Promise(resolve => {
          finishRetry = resolve
        })
      )

    render(<AppBootstrap config={config} />)
    const retry = await screen.findByRole('button', { name: 'Retry' })
    await userEvent.dblClick(retry)

    expect(screen.getByTestId('sso-unreachable')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry' })).toBe(retry)
    expect(retry).toHaveFocus()
    expect(completeConfigMock).toHaveBeenCalledTimes(2)
    finishRetry(completed(config))
    expect(await screen.findByTestId('app')).toHaveTextContent('basic mode')
  })

  it('shows the generic error screen when completing the configuration fails otherwise', async () => {
    completeConfigMock.mockRejectedValue(new Error('boom'))

    render(<AppBootstrap config={makeConfig()} />)

    expect(await screen.findByTestId('start-error')).toHaveTextContent(
      'An error occurred'
    )
    expect(screen.queryByText('Check your connection, then try again.')).toBe(
      null
    )
    expect(document.title).toBe('Error - Twake Mail')
    expect(screen.queryByTestId('sso-unreachable')).toBe(null)
    expect(screen.queryByTestId('app')).toBe(null)
  })
})
