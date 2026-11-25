import { QueryClient } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'

import { requestVersionCheck } from '@linagora/twake-react-new-version'

import { AppProviders } from '@common/app/AppProviders'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { resolveConfig, type AppConfig } from '@common/config/config'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import { ANONYMOUS } from '@common/features/auth/types'
import { makeFakeBasicAuthService } from '@common/testing/makeFakeAuthService'

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

function renderCheck(
  config: AppConfig,
  notesAtLoad = false,
  authService = makeFakeBasicAuthService()
): void {
  render(
    <AppProviders lang="en" queryClient={new QueryClient()}>
      <AppConfigProvider config={config}>
        <AuthProvider service={authService}>
          <NewVersionCheck notesAtLoad={notesAtLoad} />
        </AuthProvider>
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

  it('draws the image of release-notes/ in the theme of the app', async () => {
    renderCheck(makeConfig({ NEW_VERSION_CHECK_ENABLED: 'true' }))

    await askForCheck()

    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe(
      '/release-notes/whats-new-light.png'
    )
  })

  describe('notes at load', () => {
    beforeEach(() => {
      window.localStorage.clear()
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            build: process.env.BUILD_VERSION ?? 'dev',
            notes: { en: '- Dark mode' }
          })
      })
    })

    it('shows the release notes of the running build with notesAtLoad', async () => {
      renderCheck(makeConfig({ NEW_VERSION_CHECK_ENABLED: 'true' }), true)

      expect(
        await screen.findByRole('dialog', { name: "What's new in Twake Mail" })
      ).toHaveTextContent('Dark mode')
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    })

    it('waits for the user to sign in, never over the login page', async () => {
      const authService = makeFakeBasicAuthService(ANONYMOUS)
      renderCheck(
        makeConfig({ NEW_VERSION_CHECK_ENABLED: 'true' }),
        true,
        authService
      )
      await act(async () => {
        await Promise.resolve()
      })
      expect(fetchMock).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeNull()

      act(() =>
        authService.store.setState({
          status: 'authenticated',
          user: {
            email: 'alice@example.com',
            name: 'Alice Martin',
            workplaceFqdn: null
          }
        })
      )

      expect(
        await screen.findByRole('dialog', { name: "What's new in Twake Mail" })
      ).toHaveTextContent('Dark mode')
    })

    it('reads nothing at load without notesAtLoad', async () => {
      renderCheck(makeConfig({ NEW_VERSION_CHECK_ENABLED: 'true' }))

      await act(async () => {
        await Promise.resolve()
      })

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
