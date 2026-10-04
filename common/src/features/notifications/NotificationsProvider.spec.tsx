import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'

import { useNotify } from './NotificationsProvider'

function Notifier({ onUndo }: { onUndo: () => void }): ReactElement {
  const { notify, undoLast } = useNotify()
  const handleMove = (): void => {
    notify({
      message: 'Moved to Trash',
      severity: 'success',
      action: { label: 'Undo', onClick: onUndo, isUndo: true }
    })
  }
  const handleInfo = (): void => {
    notify({ message: 'Just so you know' })
  }
  const handleUndoLast = (): void => {
    undoLast()
  }
  return (
    <>
      <button type="button" onClick={handleMove}>
        Move
      </button>
      <button type="button" onClick={handleInfo}>
        Inform
      </button>
      <button type="button" onClick={handleUndoLast}>
        Undo last
      </button>
    </>
  )
}

function renderNotifier(onUndo = jest.fn()): jest.Mock {
  render(
    <AppProviders lang="en" queryClient={makeQueryClient()}>
      <Notifier onUndo={onUndo} />
    </AppProviders>
  )
  return onUndo
}

describe('NotificationsProvider', () => {
  it('shows one toast at a time, the last one', async () => {
    renderNotifier()

    await userEvent.click(screen.getByRole('button', { name: 'Move' }))
    await userEvent.click(screen.getByRole('button', { name: 'Inform' }))

    const toast = screen.getByTestId('toast')
    expect(toast).toHaveTextContent('Just so you know')
    expect(screen.getAllByTestId('toast')).toHaveLength(1)
  })

  it('runs the undo of the toast shown, from its button or from elsewhere', async () => {
    const onUndo = renderNotifier()

    await userEvent.click(screen.getByRole('button', { name: 'Move' }))
    await userEvent.click(
      within(screen.getByTestId('toast')).getByRole('button', { name: 'Undo' })
    )
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('toast')).toBe(null)

    await userEvent.click(screen.getByRole('button', { name: 'Move' }))
    await userEvent.click(screen.getByRole('button', { name: 'Undo last' }))
    expect(onUndo).toHaveBeenCalledTimes(2)

    // Nothing left to undo
    await userEvent.click(screen.getByRole('button', { name: 'Undo last' }))
    expect(onUndo).toHaveBeenCalledTimes(2)
  })
})
