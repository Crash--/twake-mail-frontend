import { Menu, MenuItem } from '@linagora/twake-mui'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { MenuSubmenuItem } from './MenuSubmenu'

function renderMenu(onPick = jest.fn()): jest.Mock {
  renderDs(
    <Menu open anchorEl={document.body} disableEnforceFocus>
      <MenuItem>Star</MenuItem>
      <MenuSubmenuItem label="Label as" menuLabel="Labels">
        <MenuItem onClick={onPick}>Work</MenuItem>
        <MenuItem>Personal</MenuItem>
      </MenuSubmenuItem>
    </Menu>
  )
  return onPick
}

describe('MenuSubmenuItem', () => {
  it('opens its submenu with ArrowRight on its first entry, and ArrowLeft gives the focus back', async () => {
    renderMenu()
    const entry = screen.getByRole('menuitem', { name: 'Label as' })
    expect(entry).toHaveAttribute('aria-haspopup', 'menu')
    expect(entry).toHaveAttribute('aria-expanded', 'false')

    entry.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(entry).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Labels' })).toBeVisible()
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Work' })).toHaveFocus()
    })
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Personal' })).toHaveFocus()

    await userEvent.keyboard('{ArrowLeft}')
    expect(entry).toHaveAttribute('aria-expanded', 'false')
    expect(entry).toHaveFocus()
  })

  it('opens on hover, and closes once an entry is chosen', async () => {
    const onPick = renderMenu()
    await userEvent.hover(screen.getByRole('menuitem', { name: 'Label as' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Work' }))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu', { name: 'Labels' })).toBe(null)
  })
})
