import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import type { AuthService } from '@common/features/auth/types'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import { makeFakeBasicAuthService } from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppLayout } from './AppLayout'

function renderLayout(
  authService: AuthService = makeFakeBasicAuthService()
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(<AppLayout />, {
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
      'Compose'
    )
    expect(await screen.findByRole('tree', { name: 'Mailboxes' })).toBe(
      screen.getByTestId('mailbox-tree')
    )
    expect(
      within(screen.getByTestId('main-content')).getByText('Routed content')
    ).toBeVisible()
  })

  it('puts the logotype, the search and the settings button in the platform bar, as tmail-flutter', async () => {
    mockViewport({ width: 1440 })
    renderLayout()

    const row = await screen.findByTestId('search-row')
    const bar = screen.getByTestId('twake-bar')

    expect(screen.queryByTestId('top-bar')).toBe(null)
    expect(bar).toContainElement(row)
    expect(within(row).getByTestId('search-input')).toBeVisible()
    expect(within(bar).getByRole('button', { name: 'Settings' })).toBeVisible()
    expect(within(bar).getByRole('img', { name: 'Twake Mail' })).toBeVisible()
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
      return renderWithProviders(<AppLayout />, {
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

      await screen.findByTestId('twake-bar')
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
    // A screen with room for two windows of the dock
    const initialWidth = window.innerWidth
    window.innerWidth = 1700
    try {
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
    } finally {
      window.innerWidth = initialWidth
    }
  })

  it('logs out from the bar when there is no platform to ask', async () => {
    const authService = makeFakeBasicAuthService()
    renderLayout(authService)

    const bar = await screen.findByTestId('twake-bar')
    expect(bar).toHaveAttribute('data-status', 'public')
    await userEvent.click(within(bar).getByTestId('logout-button'))

    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalledTimes(1)
    })
  })

  it('focuses the search with the / key', async () => {
    renderLayout()

    await userEvent.click(await screen.findByTestId('main-content'))
    await userEvent.keyboard('/')

    expect(screen.getByTestId('search-input')).toHaveFocus()
    expect(screen.getByTestId('search-input')).toHaveValue('')
  })

  it('puts the focus in the main content when it arrives with nowhere to go', async () => {
    renderLayout()

    await screen.findByText('Routed content')

    expect(screen.getByTestId('main-content')).toHaveFocus()
  })

  it('starts the Tab order with a link to the main content', async () => {
    const user = userEvent.setup()
    renderLayout()
    await screen.findByText('Routed content')
    screen.getByTestId('main-content').blur()

    await user.tab()
    const skipLink = screen.getByRole('link', { name: 'Skip to main content' })

    expect(skipLink).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(screen.getByTestId('main-content')).toHaveFocus()
  })

  it('keeps the drawer, the menu button and the floating button off a desktop', async () => {
    renderLayout()

    await screen.findByTestId('twake-bar')
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
    renderWithProviders(<AppLayout />, {
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
      'Compose'
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
    const tree = within(drawer).getByRole('tree', { name: 'Mailboxes' })
    expect(
      within(drawer).getByRole('img', { name: 'Twake Mail' })
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
