import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Route } from 'react-router'

import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { resolveConfig, type AppListEntry } from '@common/config/config'
import { makeFakeOidcAuthService } from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppLayout } from './AppLayout'

const mockIsInIframe = jest.fn<boolean, []>()

jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => ({ isInIframe: mockIsInIframe }))
}))

const APPS: AppListEntry[] = [
  { name: 'Chat', link: 'https://chat.example.com', icon: '/chat.svg' },
  {
    name: 'Twake Drive',
    link: 'https://{workplaceFqdn.localpart}-drive.{workplaceFqdn.domain}',
    icon: '/drive.svg'
  }
]

function withConfig(
  ui: ReactElement,
  workplaceEmbedding: boolean
): ReactElement {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      WORKPLACE_EMBEDDING: workplaceEmbedding,
      WORKPLACE_FQDN_FALLBACK: '{localpart}.twake.example.com'
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error('Invalid configuration')
  return <AppConfigProvider config={result.value}>{ui}</AppConfigProvider>
}

function renderLayout(workplaceEmbedding: boolean): void {
  renderWithProviders(
    withConfig(<AppLayout apps={APPS} />, workplaceEmbedding),
    {
      path: '/',
      authService: makeFakeOidcAuthService({
        status: 'authenticated',
        user: {
          email: 'alice@example.com',
          name: 'Alice Martin',
          workplaceFqdn: 'acme.twake.example.com'
        }
      }),
      withJmapSession: true,
      childRoutes: <Route index element={<p>Routed content</p>} />
    }
  )
}

describe('AppLayout in Twake Workplace', () => {
  it('resolves the address of the Drive of the user from its workplace', async () => {
    mockIsInIframe.mockReturnValue(false)
    renderLayout(true)

    await userEvent.click(await screen.findByTestId('app-grid-toggle-button'))

    const items = within(screen.getByTestId('app-grid-list')).getAllByRole(
      'menuitem'
    )
    expect(items.map(item => item.getAttribute('href'))).toEqual([
      'https://chat.example.com',
      'https://acme-drive.twake.example.com'
    ])
  })

  it('leaves the logotype and the app grid to the container, a gear opening the account menu', async () => {
    mockIsInIframe.mockReturnValue(true)
    renderLayout(true)

    expect(await screen.findByText('Routed content')).toBeVisible()
    expect(screen.queryByRole('img', { name: 'Twake Mail' })).toBe(null)
    expect(screen.queryByTestId('app-grid-toggle-button')).toBe(null)
    await userEvent.click(
      screen.getByRole('button', { name: 'Manage account' })
    )
    expect(screen.getByTestId('settings-menu-item')).toBeVisible()
  })

  it('stays as it is in an iframe without WORKPLACE_EMBEDDING', async () => {
    mockIsInIframe.mockReturnValue(true)
    renderLayout(false)

    expect(await screen.findByRole('img', { name: 'Twake Mail' })).toBeVisible()
    expect(screen.getByTestId('app-grid-toggle-button')).toBeVisible()
  })
})
