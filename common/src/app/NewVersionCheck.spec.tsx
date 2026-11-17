import { QueryClient } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'

import { requestVersionCheck } from '@linagora/twake-react-new-version'

import { AppProviders } from '@common/app/AppProviders'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { resolveConfig, type AppConfig } from '@common/config/config'

import { NewVersionCheck } from './NewVersionCheck'

const ORIGIN = 'https://mail.example.com'

function makeConfig(source: Record<string, unknown> = {}): AppConfig {
  const result = resolveConfig(
    { SERVER_URL: 'https://jmap.example.com', AUTH_MODE: 'basic', ...source },
    ORIGIN
  )
  if (!result.ok) throw new Error('invalid test configuration')
  return result.value
}

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ build: 'a-newer-build' })
  })
  global.fetch = fetchMock
})

function renderCheck(config: AppConfig): void {
  render(
    <AppProviders lang="en" queryClient={new QueryClient()}>
      <AppConfigProvider config={config}>
        <NewVersionCheck />
      </AppConfigProvider>
    </AppProviders>
  )
}

async function askForCheck(): Promise<void> {
  await act(async () => {
    requestVersionCheck()
    await Promise.resolve()
  })
}

describe('NewVersionCheck', () => {
  it('never asks for /version.json without NEW_VERSION_CHECK_ENABLED', async () => {
    renderCheck(makeConfig())

    await askForCheck()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers a reload with NEW_VERSION_CHECK_ENABLED once another build is served', async () => {
    renderCheck(makeConfig({ NEW_VERSION_CHECK_ENABLED: 'true' }))

    await askForCheck()

    expect(fetchMock).toHaveBeenCalledWith('/version.json', {
      cache: 'no-store'
    })
    expect(
      await screen.findByRole('dialog', { name: "What's new in Twake Mail" })
    ).toBeInTheDocument()
  })
})
