import { render, screen } from '@testing-library/react'

import { completeConfig } from '@common/config/completeConfig'
import { resolveConfig, type AppConfig } from '@common/config/config'

import { AppBootstrap } from './AppBootstrap'
import type { TeamMailboxEmbed } from './TeamMailboxEmbedApp'

jest.mock('./App', () => ({
  App: ({
    config,
    embed
  }: {
    config: AppConfig
    embed: TeamMailboxEmbed | null
  }) => (
    <div data-testid="app">
      {config.authMode} mode
      {embed === null ? '' : `, team mailbox ${embed.target.rootId}`}
    </div>
  )
}))
jest.mock('@common/config/completeConfig')

const completeConfigMock = jest.mocked(completeConfig)

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
    completeConfigMock.mockResolvedValue({ ...config, authMode: 'oidc' })

    render(<AppBootstrap config={config} />)

    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument()
    expect(await screen.findByTestId('app')).toHaveTextContent('oidc mode')
    expect(screen.queryByTestId('full-page-loader')).toBe(null)
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
    completeConfigMock.mockResolvedValue(makeConfig())

    render(<AppBootstrap config={makeConfig()} />)

    expect(await screen.findByTestId('app')).toHaveTextContent(
      'team mailbox team-root'
    )
  })

  it('starts the app with the configuration it has when completing it fails', async () => {
    completeConfigMock.mockRejectedValue(new Error('boom'))

    render(<AppBootstrap config={makeConfig()} />)

    expect(await screen.findByTestId('app')).toHaveTextContent('basic mode')
  })
})
