import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ConfirmDialogButton, ConfirmDialogFrame } from './ConfirmDialogFrame'

describe('ConfirmDialogFrame', () => {
  it('is a dialog named by its title, described by its message, closed by its cross', async () => {
    const onClose = jest.fn()
    const onConfirm = jest.fn()
    renderDs(
      <ConfirmDialogFrame
        open
        title="Empty Trash"
        message="Delete everything?"
        closeLabel="Close"
        onClose={onClose}
        titleId="title"
        messageId="message"
      >
        <ConfirmDialogButton onClick={onClose}>Cancel</ConfirmDialogButton>
        <ConfirmDialogButton isMain onClick={onConfirm}>
          Delete
        </ConfirmDialogButton>
      </ConfirmDialogFrame>
    )

    const dialog = screen.getByRole('dialog', { name: 'Empty Trash' })
    expect(dialog).toHaveAccessibleDescription('Delete everything?')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
