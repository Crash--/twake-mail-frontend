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

  it('opens from the settings button on Profiles, and goes back to the folder left', async () => {
    renderWithProviders(<AppRoutes />, {
      route: '/mailbox/mailbox-sent'
    })
    await screen.findByTestId('mailbox-page')

    await userEvent.click(screen.getByTestId('settings-button'))

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Profiles'
    })
    await waitFor(() => {
      expect(heading).toHaveFocus()
    })
    const nav = screen.getByRole('navigation', { name: 'Manage account' })
    // Its list is not a second, unnamed landmark inside it
    expect(within(nav).queryByRole('navigation')).toBe(null)
    expect(within(nav).getByTestId('settings-menu-profiles')).toHaveAttribute(
      'aria-current',
      'page'
    )
    // The unread count of the Inbox comes first, as on every screen
    expect(document.title).toBe('(2) Profiles - Settings - Twake Mail')
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
    // Back to what opened the settings, not to the page body
    await waitFor(() => {
      expect(screen.getByTestId('settings-button')).toHaveFocus()
    })
  })

  it('gives the focus back to the settings button on a phone', async () => {
    mockViewport({ width: 390, touch: true })
    renderWithProviders(<AppRoutes />, { route: '/mailbox/mailbox-sent' })
    await screen.findByTestId('mailbox-page')

    await userEvent.click(screen.getByTestId('settings-button'))
    await screen.findByTestId('settings-section-list')

    await userEvent.click(screen.getByTestId('settings-back-button'))
    await screen.findByTestId('mailbox-page')
    await waitFor(() => {
      expect(screen.getByTestId('settings-button')).toHaveFocus()
    })
  })

  it('lists the sections on a phone, then opens one in their place', async () => {
    mockViewport({ width: 390, touch: true })
    renderWithProviders(<AppRoutes />, { route: '/settings' })

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
    renderWithProviders(<AppRoutes />, {
      route: '/settings/nothing-here'
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Profiles' })
    ).toBeVisible()
  })

  it('switches the conversations in Preferences', async () => {
    renderWithProviders(<AppRoutes />, {
      route: '/settings/preferences'
    })

    // Off before each test (listEmailsOneByOne)
    const toggle = await screen.findByRole('switch', { name: 'Enable thread' })
    expect(toggle).not.toBeChecked()
    expect(toggle).toHaveAccessibleDescription(
      'Thread View multiple related emails like a conversation'
    )

    await userEvent.click(toggle)

    expect(toggle).toBeChecked()
    expect(window.localStorage.getItem('twake-mail.preferences.thread')).toBe(
      'true'
    )
  })
})
