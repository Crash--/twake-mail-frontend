import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import type { AppListEntry } from '@common/config/config'
import type { AuthService } from '@common/features/auth/types'
import {
  FAKE_USERNAME,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  makeFakeBasicAuthService,
  makeFakeOidcAuthService
} from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppLayout } from './AppLayout'

const APPS: AppListEntry[] = [
  { name: 'Chat', link: 'https://chat.example.com', icon: '/chat.svg' },
  { name: 'Twake Drive', link: 'https://drive.example.com', icon: '/drive.svg' }
]

function renderLayout(
  apps: AppListEntry[] = APPS,
  authService: AuthService = makeFakeBasicAuthService()
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(<AppLayout apps={apps} />, {
    path: '/',
    authService,
    withJmapSession: true,
    childRoutes: <Route index element={<p>Routed content</p>} />
  })
}

describe('AppLayout', () => {
  afterEach(resetViewport)

  it('shows the top bar, the sidebar and the routed content', async () => {
    renderLayout()

    expect(await screen.findByRole('img', { name: 'Twake Mail' })).toBeVisible()
    expect(screen.getByTestId('search-input')).toHaveAttribute(
      'placeholder',
      'Search emails'
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

  it('puts the search and the settings button in the page, under the top bar', async () => {
    mockViewport({ width: 1440 })
    renderLayout()

    const row = await screen.findByTestId('search-row')

    expect(
      within(screen.getByTestId('top-bar')).queryByTestId('search-input')
    ).toBe(null)
    expect(within(row).getByTestId('search-input')).toBeVisible()
    expect(within(row).getByRole('button', { name: 'Settings' })).toBeVisible()
    expect(
      within(screen.getByTestId('top-bar')).getByTestId('workplace-logo')
    ).toBeInTheDocument()
  })

  it('keeps the search in the top bar below the desktop size', async () => {
    mockViewport({ width: 820, touch: true })
    renderLayout()

    expect(await screen.findByTestId('search-input')).toBeVisible()
    expect(screen.queryByTestId('search-row')).toBe(null)
    expect(
      within(screen.getByTestId('top-bar')).getByTestId('search-input')
    ).toBeVisible()
  })

  describe('help button', () => {
    function renderWithSupport(
      support: Record<string, string> | null
    ): ReturnType<typeof renderWithProviders> {
      return renderWithProviders(<AppLayout apps={APPS} />, {
        path: '/',
        withJmapSession: true,
        jmapServer: makeFakeJmapServer(
          support === null
            ? {}
            : {
                capabilities: {
                  'com:linagora:params:jmap:contact:support': support
                }
              }
        ),
        childRoutes: <Route index element={<p>Routed content</p>} />
      })
    }

    it('is absent without the contact support capability', async () => {
      renderWithSupport(null)

      await screen.findByTestId('top-bar')
      expect(
        screen.queryByRole('button', { name: 'Get help or report a bug' })
      ).toBe(null)
    })

    it('writes to the support address from the composer', async () => {
      renderWithSupport({ supportMailAddress: 'support@example.com' })

      await userEvent.click(
        await screen.findByRole('button', { name: 'Get help or report a bug' })
      )

      expect(
        await screen.findByRole('dialog', { name: 'New message' })
      ).toBeVisible()
    })

    it('links to the support page in a new tab', async () => {
      renderWithSupport({ httpLink: 'https://support.example.com/help' })

      const link = await screen.findByRole('link', {
        name: 'Get help or report a bug'
      })

      expect(link).toHaveAttribute('href', 'https://support.example.com/help')
      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  it('opens the composer from "New message" and with the c key', async () => {
    renderLayout()

    await userEvent.click(await screen.findByTestId('compose-email-button'))
    expect(
      await screen.findByRole('dialog', { name: 'New message' })
    ).toBeVisible()

    await userEvent.click(screen.getByTestId('main-content'))
    await userEvent.keyboard('c')
    await waitFor(() => {
      expect(
        screen.getAllByRole('dialog', { name: 'New message' })
      ).toHaveLength(2)
    })
  })

  it('lists the other applications in the app grid', async () => {
    renderLayout()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Go to applications' })
    )

    const [chatLink, driveLink] = screen.getAllByTestId('app-grid-item')
    expect(chatLink).toHaveTextContent('Chat')
    expect(driveLink).toHaveTextContent('Twake Drive')
    expect(driveLink).toHaveAttribute('href', 'https://drive.example.com')
    expect(driveLink).toHaveAttribute('target', '_blank')
    expect(driveLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('hides the app grid when no application is configured', async () => {
    renderLayout([])

    await screen.findByTestId('top-bar')
    expect(screen.queryByTestId('app-grid-toggle-button')).toBe(null)
  })

  it('shows who is signed in and logs out from the user menu', async () => {
    const authService = makeFakeBasicAuthService()
    renderLayout(APPS, authService)

    await userEvent.click(await screen.findByTestId('user-avatar'))

    const identity = screen.getByTestId('user-menu-identity')
    expect(identity).toHaveTextContent('Alice Martin')
    expect(identity).toHaveTextContent('alice@example.com')

    await userEvent.click(screen.getByTestId('logout-button'))

    expect(authService.logout).toHaveBeenCalledTimes(1)
  })

  it('shows the username of the JMAP session when the SSO gave no email', async () => {
    renderLayout(
      APPS,
      makeFakeOidcAuthService({
        status: 'authenticated',
        user: { email: null, name: null, workplaceFqdn: null }
      })
    )

    await userEvent.click(await screen.findByTestId('user-avatar'))

    expect(screen.getByTestId('user-menu-identity')).toHaveTextContent(
      FAKE_USERNAME
    )
  })

  it('shows the username of the JMAP session in basic mode', async () => {
    renderLayout(
      APPS,
      makeFakeBasicAuthService({
        status: 'authenticated',
        user: { email: 'alice', name: null, workplaceFqdn: null }
      })
    )

    await userEvent.click(await screen.findByTestId('user-avatar'))

    expect(screen.getByTestId('user-menu-identity')).toHaveTextContent(
      FAKE_USERNAME
    )
  })

  it('focuses the search with the / key', async () => {
    renderLayout()

    await userEvent.click(await screen.findByTestId('main-content'))
    await userEvent.keyboard('/')

    expect(screen.getByTestId('search-input')).toHaveFocus()
    expect(screen.getByTestId('search-input')).toHaveValue('')
  })

  it('keeps the drawer, the menu button and the floating button off a desktop', async () => {
    renderLayout()

    await screen.findByTestId('top-bar')
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-mailbox-menu-button')).toBe(null)
    expect(screen.getAllByTestId('compose-email-button')).toHaveLength(1)
  })
})

describe('AppLayout on a phone', () => {
  beforeEach(() => {
    mockViewport({ width: 390, touch: true })
  })
  afterEach(resetViewport)

  function renderPhoneLayout(): void {
    renderWithProviders(<AppLayout apps={APPS} />, {
      route: '/mailbox/mailbox-inbox',
      path: '*',
      withJmapSession: true,
      childRoutes: (
        <Route path="mailbox/:mailboxId" element={<p>Folder content</p>} />
      )
    })
  }

  it('shows the folder in the top bar, the folders behind a button', async () => {
    renderPhoneLayout()

    expect(await screen.findByTestId('top-bar-folder-name')).toHaveTextContent(
      'Inbox'
    )
    expect(screen.queryByTestId('sidebar')).toBe(null)
    expect(screen.queryByRole('tree')).toBe(null)
    expect(screen.getByTestId('compose-email-button')).toHaveTextContent(
      'New message'
    )
  })

  it('unfolds the folded search with the / key, folded back by Escape', async () => {
    renderPhoneLayout()

    await screen.findByTestId('top-bar-folder-name')
    expect(screen.queryByTestId('search-input')).toBe(null)
    await userEvent.click(screen.getByTestId('main-content'))
    await userEvent.keyboard('/')

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toHaveFocus()
    })
    expect(screen.getByTestId('search-input')).toHaveValue('')

    // The first Escape closes the suggestions, the second folds the search
    await userEvent.keyboard('{Escape}{Escape}')

    await waitFor(() => {
      expect(screen.getByTestId('search-open-button')).toHaveFocus()
    })
    expect(screen.queryByTestId('search-input')).toBe(null)
  })

  it('opens the folders in a drawer, closed once a folder is chosen', async () => {
    renderPhoneLayout()

    const menuButton = await screen.findByRole('button', {
      name: 'Show folders'
    })
    await userEvent.click(menuButton)

    const drawer = await screen.findByRole('dialog', { name: 'Navigation' })
    const tree = within(drawer).getByRole('tree', { name: 'Folders' })
    expect(
      within(drawer).getByRole('img', { name: 'Twake Mail' })
    ).toBeVisible()
    // The app grid moves from the top bar to the drawer
    expect(
      within(drawer).getByRole('button', { name: 'Go to applications' })
    ).toBeVisible()
    expect(within(drawer).queryByTestId('compose-email-button')).toBe(null)

    const sent = await within(tree).findByText('Sent')
    await userEvent.click(sent)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(screen.getByTestId('top-bar-folder-name')).toHaveTextContent('Sent')
  })
})
