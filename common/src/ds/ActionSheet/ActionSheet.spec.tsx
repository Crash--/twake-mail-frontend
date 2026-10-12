import { MenuItem } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ActionSheet } from './ActionSheet'

describe('ActionSheet', () => {
  it('is a named menu, its first item focused, the arrows move', async () => {
    const onClick = jest.fn()
    renderDs(
      <ActionSheet open onClose={jest.fn()} label="Actions">
        <MenuItem onClick={onClick}>Archive</MenuItem>
        <MenuItem>Delete</MenuItem>
      </ActionSheet>
    )

    expect(screen.getByRole('menu', { name: 'Actions' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const onClose = jest.fn()
    renderDs(
      <ActionSheet open onClose={onClose} label="Actions">
        <MenuItem>Archive</MenuItem>
      </ActionSheet>
    )

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows nothing while closed', () => {
    renderDs(
      <ActionSheet open={false} onClose={jest.fn()} label="Actions">
        <MenuItem>Archive</MenuItem>
      </ActionSheet>
    )

    expect(screen.queryByRole('menu')).toBe(null)
  })
})
