import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { MailboxSwitcher, type MailboxSwitcherProps } from './MailboxSwitcher'

const GROUPS: MailboxSwitcherProps['groups'] = [
  {
    id: 'own',
    title: 'Your mailbox',
    items: [
      { id: 'me', name: 'Me', address: 'me@example.com', avatarKey: 'me' }
    ]
  },
  {
    id: 'others',
    title: 'Delegated to you',
    items: [
      { id: 'boss', name: 'Boss', address: 'boss@example.com', avatarKey: 'b' }
    ]
  },
  { id: 'empty', title: 'Nothing', items: [] }
]

function renderSwitcher(selectedId: string, onSelect = jest.fn()): jest.Mock {
  renderDs(
    <MailboxSwitcher
      groups={GROUPS}
      selectedId={selectedId}
      ownId="me"
      labels={{
        pill: `Viewing ${selectedId}`,
        open: `Switch, viewing ${selectedId}`,
        back: 'Back to yours'
      }}
      onSelect={onSelect}
    />
  )
  return onSelect
}

describe('MailboxSwitcher', () => {
  it('opens on the mailbox shown, ticked, and picks another one', async () => {
    const onSelect = renderSwitcher('me')

    const pill = screen.getByRole('button', { name: 'Switch, viewing me' })
    expect(pill).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(pill)

    const menu = screen.getByRole('menu')
    const me = within(menu).getByRole('menuitemradio', { name: /Me/ })
    expect(me).toHaveAttribute('aria-checked', 'true')
    expect(me).toHaveFocus()
    expect(within(menu).queryByText('Nothing')).toBe(null)

    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith('boss')
    expect(screen.queryByRole('menu')).toBe(null)
  })

  it('goes back to the own mailbox with its cross', async () => {
    const onSelect = renderSwitcher('boss')

    await userEvent.click(screen.getByRole('button', { name: 'Back to yours' }))

    expect(onSelect).toHaveBeenCalledWith('me')
  })

  it('has no cross on the own mailbox', () => {
    renderSwitcher('me')

    expect(screen.queryByRole('button', { name: 'Back to yours' })).toBe(null)
  })
})

describe('MailboxSwitcher reopened at once', () => {
  it('focuses the mailbox shown again, not the one left', async () => {
    renderSwitcher('me')
    const pill = screen.getByRole('button', { name: 'Switch, viewing me' })

    await userEvent.click(pill)
    await userEvent.keyboard('{ArrowDown}')
    expect(
      within(screen.getByRole('menu')).getByRole('menuitemradio', {
        name: /Boss/
      })
    ).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Enter}')

    expect(
      within(screen.getByRole('menu')).getByRole('menuitemradio', {
        name: /Me/
      })
    ).toHaveFocus()
  })
})
