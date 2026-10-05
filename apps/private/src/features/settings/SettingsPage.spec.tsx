import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppRoutes } from '../../AppRoutes'

describe('Settings', () => {
  listEmailsOneByOne()

  afterEach(() => {
    resetViewport()
  })

  it('opens from the account menu on Profiles, and goes back to the folder left', async () => {
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/mailbox/mailbox-sent'
    })
    await screen.findByTestId('mailbox-page')

    await userEvent.click(screen.getByTestId('user-avatar'))
    await userEvent.click(screen.getByTestId('settings-menu-item'))

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Profiles'
    })
    await waitFor(() => {
      expect(heading).toHaveFocus()
    })
    const nav = screen.getByRole('navigation', { name: 'Settings' })
    expect(within(nav).getByTestId('settings-menu-profiles')).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(document.title).toBe('Profiles - Settings - Twake Mail')
    expect(screen.queryByTestId('mailbox-tree')).toBe(null)

    await userEvent.click(within(nav).getByTestId('settings-menu-preferences'))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Preferences' })
    ).toBeVisible()

    await userEvent.click(screen.getByTestId('settings-back-button'))
    expect(await screen.findByTestId('mailbox-page')).toHaveAttribute(
      'data-mailbox-id',
      'mailbox-sent'
    )
  })

  it('lists the sections on a phone, then opens one in their place', async () => {
    mockViewport({ width: 390, touch: true })
    renderWithProviders(<AppRoutes apps={[]} />, { route: '/settings' })

    const list = await screen.findByTestId('settings-section-list')
    expect(
      within(list).getByRole('heading', { level: 1, name: 'Settings' })
    ).toBeVisible()
    expect(within(list).getByText('Mailbox & email actions')).toBeVisible()

    await userEvent.click(
      within(list).getByTestId('settings-menu-keyboard-shortcuts')
    )

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Keyboard shortcuts'
      })
    ).toBeVisible()
    expect(screen.getByTestId('shortcuts-enabled-switch')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('settings-section-back-button'))
    expect(await screen.findByTestId('settings-section-list')).toBeVisible()
  })

  it('goes back to the settings from an unknown section', async () => {
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/settings/nothing-here'
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Profiles' })
    ).toBeVisible()
  })

  it('switches the conversations in Preferences', async () => {
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/settings/preferences'
    })

    // Off before each test (listEmailsOneByOne)
    const toggle = await screen.findByRole('switch', { name: 'Thread' })
    expect(toggle).not.toBeChecked()
    expect(toggle).toHaveAccessibleDescription(
      'View multiple related emails like a conversation'
    )

    await userEvent.click(toggle)

    expect(toggle).toBeChecked()
    expect(window.localStorage.getItem('twake-mail.preferences.thread')).toBe(
      'true'
    )
  })
})
