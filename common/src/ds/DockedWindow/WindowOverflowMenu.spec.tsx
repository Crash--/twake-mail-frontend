import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { WindowOverflowMenu } from './WindowOverflowMenu'

const ITEMS = [
  { id: 'b', label: 'Second draft' },
  { id: 'a', label: 'bob@example.com' }
]

function renderMenu(variant: 'dock' | 'titleBar' = 'dock'): jest.Mock {
  const onSelect = jest.fn()
  renderDs(
    <>
      <WindowOverflowMenu
        label="+2 messages"
        items={ITEMS}
        onSelect={onSelect}
        variant={variant}
      />
      <button type="button">Elsewhere</button>
    </>
  )
  return onSelect
}

describe('WindowOverflowMenu', () => {
  it.each(['dock', 'titleBar'] as const)(
    'is a named menu button (%s)',
    variant => {
      renderMenu(variant)

      const button = screen.getByRole('button', { name: '+2 messages' })
      expect(button).toHaveAttribute('aria-haspopup', 'menu')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    }
  )

  it('lists the windows left out, chosen with the arrow keys', async () => {
    const onSelect = renderMenu()
    const button = screen.getByRole('button', { name: '+2 messages' })

    act(() => {
      button.focus()
    })
    await userEvent.keyboard('{Enter}')

    const menu = screen.getByRole('menu', { name: '+2 messages' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', menu.id)
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent)
    ).toEqual(['Second draft', 'bob@example.com'])
    await waitFor(() => {
      expect(
        within(menu).getByRole('menuitem', { name: 'Second draft' })
      ).toHaveFocus()
    })

    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledWith('a')
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null)
    })
    // The caller moves the focus to the window chosen
    expect(button).not.toHaveFocus()
  })

  it('gives the focus back to the button when closed with Escape', async () => {
    const onSelect = renderMenu()
    const button = screen.getByRole('button', { name: '+2 messages' })

    await userEvent.click(button)
    await screen.findByRole('menu')
    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null)
    })
    expect(button).toHaveFocus()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
