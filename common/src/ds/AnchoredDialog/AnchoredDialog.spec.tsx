import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { AnchoredDialog } from './AnchoredDialog'

function Harness(): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <div ref={setAnchor}>Anchor</div>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
        }}
      >
        Open
      </button>
      <AnchoredDialog
        open={isOpen}
        anchorEl={anchor}
        title="Advanced search"
        onClose={() => {
          setIsOpen(false)
        }}
      >
        <input aria-label="Name" />
      </AnchoredDialog>
    </>
  )
}

describe('AnchoredDialog', () => {
  it('is a named dialog, closed by Escape, giving the focus back', async () => {
    renderDs(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })

    await userEvent.click(opener)

    expect(
      screen.getByRole('dialog', { name: 'Advanced search' })
    ).toBeVisible()

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(opener).toHaveFocus()
  })

  it('lets the page around take the pointer, closing on a click outside', async () => {
    renderDs(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog', { name: 'Advanced search' })

    // The modal root, and its invisible backdrop, let the pointer through
    expect(dialog.parentElement).toHaveStyle({ pointerEvents: 'none' })
    expect(dialog).toHaveStyle({ pointerEvents: 'auto' })

    await userEvent.click(screen.getByRole('textbox', { name: 'Name' }))

    expect(dialog).toBeVisible()

    await userEvent.click(screen.getByText('Anchor'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
  })
})
