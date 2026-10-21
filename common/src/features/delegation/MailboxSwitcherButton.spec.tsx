import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { MailboxSwitcherButton } from './MailboxSwitcherButton'

describe('MailboxSwitcherButton', () => {
  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('is not shown to a user with their own mailbox only', async () => {
    const { jmapServer } = renderWithProviders(<MailboxSwitcherButton />, {
      withJmapSession: true
    })

    // Once its folders are known: no team mailbox among them
    await waitFor(() => {
      expect(jmapServer.calledMethods()).toContain('Mailbox/get')
    })
    expect(screen.queryByTestId('mailbox-switcher-button')).toBe(null)
  })

  it('switches to a delegated mailbox and to a team mailbox, then back', async () => {
    const server = makeFakeJmapServer({
      mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()],
      delegatedAccounts: [
        { accountId: 'account-boss', name: 'boss@example.com' }
      ]
    })
    renderWithProviders(<MailboxSwitcherButton />, {
      withJmapSession: true,
      jmapServer: server
    })

    const pill = await screen.findByRole('button', {
      name: 'Switch mailbox, viewing My email'
    })
    await userEvent.click(pill)
    const menu = screen.getByRole('menu')
    expect(
      within(menu).getByRole('menuitemradio', { name: /alice@example\.com/ })
    ).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).getByText('Delegated to you')).toBeVisible()
    expect(within(menu).getByText('Team mailboxes')).toBeVisible()
    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: /boss@example\.com/ })
    )

    expect(
      await screen.findByRole('button', {
        name: 'Switch mailbox, viewing boss@example.com'
      })
    ).toBeVisible()
    expect(screen.getByText('Viewing boss@example.com')).toBeVisible()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Switch mailbox, viewing boss@example.com'
      })
    )
    await userEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitemradio', {
        name: /team@example\.com/
      })
    )
    expect(
      await screen.findByRole('button', {
        name: 'Switch mailbox, viewing team'
      })
    ).toBeVisible()

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to your mailbox' })
    )
    expect(
      await screen.findByRole('button', {
        name: 'Switch mailbox, viewing My email'
      })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Back to your mailbox' })).toBe(
      null
    )
  })
})
