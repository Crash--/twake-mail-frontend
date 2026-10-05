import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
})
