import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'

import { useAlert, useChoose, useConfirm } from './ConfirmProvider'

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

function Alerter(): ReactElement {
  const alert = useAlert()
  const [answer, setAnswer] = useState('none')
  const handleAsk = (): void => {
    void alert({
      title: 'Sending failed',
      message: 'Your email should have at least one recipient',
      confirmLabel: 'Add recipients'
    }).then(() => {
      setAnswer('acknowledged')
    })
  }
  return (
    <>
      <button type="button" onClick={handleAsk}>
        Send
      </button>
      <p>Alert: {answer}</p>
    </>
  )
}

/** Asks two questions at once, as two messages of a conversation do */
function TwoAskers({ queue }: { queue: boolean }): ReactElement {
  const confirm = useConfirm()
  const [answers, setAnswers] = useState<string[]>([])
  const handleAsk = (): void => {
    for (const name of ['Alice', 'Bob']) {
      void confirm({
        title: `Receipt for ${name}`,
        message: `${name} asked for a read receipt.`,
        confirmLabel: 'Yes',
        cancelLabel: 'No',
        queue
      }).then(confirmed => {
        setAnswers(current => [...current, `${name}: ${String(confirmed)}`])
      })
    }
  }
  return (
    <>
      <button type="button" onClick={handleAsk}>
        Open conversation
      </button>
      <p>Answers: {answers.join(', ')}</p>
    </>
  )
}

function renderTwoAskers(queue: boolean): void {
  render(
    <AppProviders lang="en" queryClient={makeQueryClient()}>
      <TwoAskers queue={queue} />
    </AppProviders>
  )
}

function renderAsker(): void {
  render(
    <AppProviders lang="en" queryClient={makeQueryClient()}>
      <Asker />
      <Chooser />
      <Alerter />
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

  it('alerts with one button, focused', async () => {
    renderAsker()

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    const dialog = screen.getByRole('dialog', { name: 'Sending failed' })
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBe(null)
    expect(
      within(dialog).getByRole('button', { name: 'Add recipients' })
    ).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Alert: acknowledged')).toBeVisible()
  })

  it('asks queued questions one after the other, then gives the focus back', async () => {
    renderTwoAskers(true)
    const opener = screen.getByRole('button', { name: 'Open conversation' })

    await userEvent.click(opener)
    expect(
      screen.getByRole('dialog', { name: 'Receipt for Alice' })
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))

    const second = await screen.findByRole('dialog', {
      name: 'Receipt for Bob'
    })
    await waitFor(() => {
      expect(within(second).getByRole('button', { name: 'No' })).toHaveFocus()
    })
    await userEvent.keyboard('{Enter}')

    expect(
      await screen.findByText('Answers: Alice: true, Bob: false')
    ).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(opener).toHaveFocus()
  })

  it('replaces the open question with a new one unless queued', async () => {
    renderTwoAskers(false)

    await userEvent.click(
      screen.getByRole('button', { name: 'Open conversation' })
    )

    expect(
      screen.getByRole('dialog', { name: 'Receipt for Bob' })
    ).toBeVisible()
    expect(await screen.findByText('Answers: Alice: false')).toBeVisible()
  })
})
