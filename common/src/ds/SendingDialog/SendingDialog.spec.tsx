import { screen } from '@testing-library/react'

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
