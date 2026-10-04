import { Help } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { AccountMenu } from './AccountMenu'

describe('AccountMenu', () => {
  it('shows the identity and signs out', async () => {
    const onLogout = jest.fn()
    renderDs(
      <AccountMenu
        name="Alice Martin"
        email="alice@example.com"
        label="My account"
        logoutLabel="Sign out"
        onLogout={onLogout}
        testIds={{ identity: 'identity' }}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'My account' }))

    expect(screen.getByTestId('identity')).toHaveTextContent(
      'Alice Martinalice@example.com'
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBe(null)
  })

  it('shows the email alone when the name is unknown', async () => {
    renderDs(
      <AccountMenu
        name={null}
        email="alice@example.com"
        label="My account"
        logoutLabel="Sign out"
        onLogout={jest.fn()}
        testIds={{ identity: 'identity' }}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'My account' }))

    expect(screen.getByTestId('identity')).toHaveTextContent(
      /^alice@example\.com$/
    )
  })

  it('runs the extra items, then closes', async () => {
    const onShortcuts = jest.fn()
    renderDs(
      <AccountMenu
        name="Alice"
        email="alice@example.com"
        label="My account"
        logoutLabel="Sign out"
        onLogout={jest.fn()}
        items={[
          { label: 'Keyboard shortcuts', icon: Help, onClick: onShortcuts }
        ]}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'My account' }))
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Keyboard shortcuts' })
    )

    expect(onShortcuts).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBe(null)
  })
})
