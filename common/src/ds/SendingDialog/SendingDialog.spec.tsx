import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { SendingDialog } from './SendingDialog'

describe('SendingDialog', () => {
  it('is a busy dialog named by its title, saying the step and its progress', () => {
    renderDs(
      <SendingDialog
        open
        title="Sending message"
        statusLabel="Status"
        status="Creating message"
        progressLabel="Progress"
      />
    )

    const dialog = screen.getByRole('dialog', { name: 'Sending message' })
    expect(dialog).toHaveAccessibleDescription('Creating message...')
    expect(screen.getByRole('progressbar', { name: 'Progress:' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Creating message...')
  })

  it('says the server is slow and closes on its button or Escape', async () => {
    const onClose = jest.fn()
    renderDs(
      <SendingDialog
        open
        title="Sending message"
        statusLabel="Status"
        status="Sending message"
        progressLabel="Progress"
        slowMessage="It is taking long."
        closeLabel="Close"
        onClose={onClose}
      />
    )

    const dialog = screen.getByRole('dialog', { name: 'Sending message' })
    expect(dialog).toHaveAccessibleDescription(
      'Sending message... It is taking long.'
    )
    expect(screen.getByRole('alert')).toHaveTextContent('It is taking long.')
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    await userEvent.click(close)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('cannot be closed before the server is slow', async () => {
    const onClose = jest.fn()
    renderDs(
      <SendingDialog
        open
        title="Sending message"
        statusLabel="Status"
        status="Creating message"
        progressLabel="Progress"
        closeLabel="Close"
        onClose={onClose}
      />
    )

    expect(screen.queryByRole('button', { name: 'Close' })).toBe(null)
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows nothing while closed', () => {
    renderDs(
      <SendingDialog
        open={false}
        title="Sending message"
        statusLabel="Status"
        status="Creating message"
        progressLabel="Progress"
      />
    )

    expect(screen.queryByRole('dialog')).toBe(null)
  })
})
