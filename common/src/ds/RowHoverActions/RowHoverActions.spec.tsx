import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { RowHoverActions } from './RowHoverActions'

describe('RowHoverActions', () => {
  it('keeps its actions in the tab order', async () => {
    renderDs(
      <>
        <a href="/previous">Previous</a>
        <RowHoverActions>
          <button type="button">Mark as read</button>
        </RowHoverActions>
      </>
    )
    screen.getByRole('link', { name: 'Previous' }).focus()

    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'Mark as read' })).toHaveFocus()
  })

  it('keeps what the actions replace in the page, before the actions', async () => {
    renderDs(
      <>
        <RowHoverActions replaces={<time>Aug 29</time>}>
          <button type="button">Delete</button>
        </RowHoverActions>
      </>
    )

    expect(screen.getByText('Aug 29')).toBeInTheDocument()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
  })

  describe('lazy', () => {
    afterEach(() => {
      resetViewport()
    })

    function renderRows(): void {
      renderDs(
        <ul>
          <li className="MuiListItem-root" data-testid="first-row">
            <a href="/first">First</a>
            <RowHoverActions in="listItem" lazy replaces={<time>Aug 29</time>}>
              <button type="button">Delete</button>
            </RowHoverActions>
          </li>
          <li className="MuiListItem-root">
            <a href="/second">Second</a>
          </li>
        </ul>
      )
    }

    it('mounts the actions once the row is hovered, and keeps them', async () => {
      mockViewport({ width: 1440 })
      renderRows()

      expect(screen.getByText('Aug 29')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete' })).toBe(null)
      await userEvent.hover(screen.getByTestId('first-row'))
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
      await userEvent.unhover(screen.getByTestId('first-row'))
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('reaches the actions with Tab from the row', async () => {
      mockViewport({ width: 1440 })
      renderRows()
      screen.getByRole('link', { name: 'First' }).focus()

      await userEvent.tab()

      expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
    })

    it('reaches the actions with Shift+Tab from the row after', async () => {
      mockViewport({ width: 1440 })
      renderRows()
      screen.getByRole('link', { name: 'Second' }).focus()

      await userEvent.tab({ shift: true })

      expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
    })

    it('always shows the actions on a screen without hover', () => {
      mockViewport({ width: 820, touch: true })
      renderRows()

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })
  })
})
