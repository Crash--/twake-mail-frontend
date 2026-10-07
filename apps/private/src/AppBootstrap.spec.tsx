import { render, screen } from '@testing-library/react'

import { completeConfig } from '@common/config/completeConfig'
import { resolveConfig, type AppConfig } from '@common/config/config'

import { AppBootstrap } from './AppBootstrap'

jest.mock('./App', () => ({
  App: ({ config }: { config: AppConfig }) => (
    <div data-testid="app">{config.authMode} mode</div>
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
  it('shows a progress indicator, then the app with the completed configuration', async () => {
    const config = makeConfig()
    completeConfigMock.mockResolvedValue({ ...config, authMode: 'oidc' })

    render(<AppBootstrap config={config} />)

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(await screen.findByTestId('app')).toHaveTextContent('oidc mode')
    expect(screen.queryByRole('progressbar')).toBe(null)
  })

  it('starts the app with the configuration it has when completing it fails', async () => {
    completeConfigMock.mockRejectedValue(new Error('boom'))

    render(<AppBootstrap config={makeConfig()} />)

    expect(await screen.findByTestId('app')).toHaveTextContent('basic mode')
  })
})
