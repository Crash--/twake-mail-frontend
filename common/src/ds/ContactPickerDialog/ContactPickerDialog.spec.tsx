import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import {
  ContactPickerDialog,
  type ContactPickerDialogProps
} from './ContactPickerDialog'

const LABELS = {
  title: 'Find emails from',
  search: 'Enter name or email',
  list: 'Contacts',
  clearFilter: 'Clear filter',
  done: 'Done'
}

function renderDialog(
  props: Partial<ContactPickerDialogProps> = {}
): ContactPickerDialogProps {
  const all: ContactPickerDialogProps = {
    open: true,
    labels: LABELS,
    query: '',
    onQueryChange: jest.fn(),
    items: [
      { address: 'alice@example.com', name: 'Alice Martin' },
      { address: 'bob@example.com', name: null }
    ],
    selected: ['Alice@example.com'],
    onToggle: jest.fn(),
    onClearFilter: jest.fn(),
    onDone: jest.fn(),
    onClose: jest.fn(),
    ...props
  }
  renderDs(<ContactPickerDialog {...all} />)
  return all
}

describe('ContactPickerDialog', () => {
  it('is a dialog of checkable contacts, the chosen ones checked', async () => {
    const props = renderDialog()

    expect(
      screen.getByRole('dialog', { name: 'Find emails from' })
    ).toBeVisible()
    const alice = screen.getByRole('checkbox', {
      name: /Alice Martin alice@example.com/
    })
    expect(alice).toBeChecked()
    const bob = screen.getByRole('checkbox', { name: 'bob@example.com' })
    expect(bob).not.toBeChecked()

    await userEvent.click(bob)

    expect(props.onToggle).toHaveBeenCalledWith({
      address: 'bob@example.com',
      name: null
    })
  })

  it('reports the typed text and clears it', async () => {
    const props = renderDialog({ query: 'ali' })

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Enter name or email' }),
      'c'
    )
    expect(props.onQueryChange).toHaveBeenLastCalledWith('alic')

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(props.onQueryChange).toHaveBeenLastCalledWith('')
  })

  it('is twake-mui’s dialog, with its own close button', async () => {
    const props = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('dialog').querySelector('.MuiDialogActions-root')
    ).toContainElement(screen.getByRole('button', { name: 'Done' }))
  })

  it('ends with "Clear filter" and "Done", and closes on Escape', async () => {
    const props = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await userEvent.keyboard('{Escape}')

    expect(props.onClearFilter).toHaveBeenCalledTimes(1)
    expect(props.onDone).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
