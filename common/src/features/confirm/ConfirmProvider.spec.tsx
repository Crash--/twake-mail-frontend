import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'

import { useChoose, useConfirm } from './ConfirmProvider'

function Asker(): ReactElement {
  const confirm = useConfirm()
  const [answer, setAnswer] = useState('none')
  const handleAsk = (): void => {
    void confirm({
      title: 'Empty Trash',
      message: 'Everything in Trash goes for good.',
      confirmLabel: 'Delete',
      isDestructive: true
    }).then(confirmed => {
      setAnswer(String(confirmed))
    })
  }
  return (
    <>
      <button type="button" onClick={handleAsk}>
        Ask
      </button>
      <p>Answer: {answer}</p>
    </>
  )
}

function Chooser(): ReactElement {
  const choose = useChoose()
  const [answer, setAnswer] = useState('none')
  const handleAsk = (): void => {
    void choose({
      title: 'Save message',
      message: 'Save this message to your drafts folder?',
      confirmLabel: 'Save',
      alternativeLabel: 'Discard changes'
    }).then(setAnswer)
  }
  return (
    <>
      <button type="button" onClick={handleAsk}>
        Close
      </button>
      <p>Answer: {answer}</p>
    </>
  )
}

function renderAsker(): void {
  render(
    <AppProviders lang="en" queryClient={makeQueryClient()}>
      <Asker />
      <Chooser />
    </AppProviders>
  )
}

describe('ConfirmProvider', () => {
  it('asks in a named dialog, focused on Cancel, and resolves on the choice', async () => {
    renderAsker()
    const ask = screen.getByRole('button', { name: 'Ask' })

    await userEvent.click(ask)
    const dialog = screen.getByRole('dialog', { name: 'Empty Trash' })
    expect(dialog).toHaveAccessibleDescription(
      'Everything in Trash goes for good.'
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Answer: true')).toBeVisible()

    await userEvent.click(ask)
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByText('Answer: false')).toBeVisible()
  })

  it('offers a choice, focused on the confirm button', async () => {
    renderAsker()
    const close = screen.getByRole('button', { name: 'Close' })

    await userEvent.click(close)
    expect(screen.getByRole('dialog', { name: 'Save message' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard changes' })
    )
    expect(await screen.findByText('Answer: alternative')).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })

    await userEvent.click(close)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Answer: confirm')).toBeVisible()

    await userEvent.click(close)
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByText('Answer: cancel')).toBeVisible()
  })
})
