import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import type { AppListEntry } from '@common/config/config'
import { makeFakeBasicAuthService } from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppLayout } from './AppLayout'

const APPS: AppListEntry[] = [
  { name: 'Chat', link: 'https://chat.example.com', icon: '/chat.svg' },
  { name: 'Twake Drive', link: 'https://drive.example.com', icon: '/drive.svg' }
]

function renderLayout(
  apps: AppListEntry[] = APPS,
  authService = makeFakeBasicAuthService()
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(<AppLayout apps={apps} />, {
    path: '/',
    authService,
    childRoutes: <Route index element={<p>Routed content</p>} />
  })
}

describe('AppLayout', () => {
  it('shows the top bar, the sidebar and the routed content', () => {
    renderLayout()

    expect(screen.getByRole('img', { name: 'Twake Mail' })).toBeVisible()
    expect(screen.getByTestId('search-input')).toHaveAttribute(
      'placeholder',
      'Search mail'
    )
    expect(screen.getByTestId('compose-email-button')).toHaveTextContent(
      'New message'
    )
    expect(screen.getByRole('tree', { name: 'Folders' })).toBe(
      screen.getByTestId('mailbox-tree')
    )
    expect(
      within(screen.getByTestId('main-content')).getByText('Routed content')
    ).toBeVisible()
  })

  it('lists the other applications in the app grid', async () => {
    renderLayout()

    await userEvent.click(
      screen.getByRole('button', { name: 'Go to applications' })
    )

    const [chatLink, driveLink] = screen.getAllByTestId('app-grid-item')
    expect(chatLink).toHaveTextContent('Chat')
    expect(driveLink).toHaveTextContent('Twake Drive')
    expect(driveLink).toHaveAttribute('href', 'https://drive.example.com')
    expect(driveLink).toHaveAttribute('target', '_blank')
    expect(driveLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('hides the app grid when no application is configured', () => {
    renderLayout([])

    expect(screen.queryByTestId('app-grid-toggle-button')).toBe(null)
  })

  it('shows who is signed in and logs out from the user menu', async () => {
    const authService = makeFakeBasicAuthService()
    renderLayout(APPS, authService)

    await userEvent.click(screen.getByTestId('user-avatar'))

    const identity = screen.getByTestId('user-menu-identity')
    expect(identity).toHaveTextContent('Alice Martin')
    expect(identity).toHaveTextContent('alice@example.com')

    await userEvent.click(screen.getByTestId('logout-button'))

    expect(authService.logout).toHaveBeenCalledTimes(1)
  })
})
