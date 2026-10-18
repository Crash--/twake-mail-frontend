import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MenuItem } from '@linagora/twake-mui'

import { renderDs } from '@/ds/testing/renderDs'

import { ProfileMenu } from './ProfileMenu'

function renderMenu(): { onManage: jest.Mock; onCopy: jest.Mock } {
  const onManage = jest.fn()
  const onCopy = jest.fn()
  renderDs(
    <ProfileMenu
      initial="B"
      address="bob@example.com"
      labels={{
        open: 'Account bob@example.com',
        close: 'Close',
        copy: 'Copy the email address',
        menu: 'Account'
      }}
      onCopy={onCopy}
    >
      {() => <MenuItem onClick={onManage}>Manage account</MenuItem>}
    </ProfileMenu>
  )
  return { onManage, onCopy }
}

describe('ProfileMenu', () => {
  it('copies the address of the user', async () => {
    const { onCopy } = renderMenu()

    await userEvent.click(
      screen.getByRole('button', { name: 'Account bob@example.com' })
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Copy the email address' })
    )

    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('keeps the tooltip of the copy button off the way of the entries', async () => {
    const { onManage } = renderMenu()

    await userEvent.click(
      screen.getByRole('button', { name: 'Account bob@example.com' })
    )
    await userEvent.hover(
      await screen.findByRole('button', { name: 'Copy the email address' })
    )
    const tooltip = await screen.findByRole('tooltip', {
      name: 'Copy the email address'
    })
    expect(getComputedStyle(tooltip).pointerEvents).toBe('none')
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Manage account' })
    )
    expect(onManage).toHaveBeenCalledTimes(1)
  })
})
