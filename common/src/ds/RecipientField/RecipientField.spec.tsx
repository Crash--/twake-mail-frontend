import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type KeyboardEvent, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  RecipientField,
  type RecipientFieldChip,
  type RecipientFieldSuggestion
} from './RecipientField'

const LABELS = {
  field: 'To',
  suggestions: 'Suggestions',
  invalid: 'invalid address',
  chipHelp: 'Delete removes, Enter edits',
  removed: (label: string) => `${label} removed`
}

const CONTACTS: RecipientFieldSuggestion[] = [
  { id: 'alice@example.com', label: 'Alice', secondary: 'alice@example.com' },
  { id: 'albert@example.com', label: 'Albert', secondary: 'albert@example.com' }
]

function toChip(text: string): RecipientFieldChip {
  return { id: text, label: text, isInvalid: !text.includes('@') }
}

/** The field with the state a caller keeps: chips split on commas */
function Harness({
  initial = [],
  onEscape = jest.fn()
}: {
  initial?: string[]
  onEscape?: () => void
}): ReactElement {
  const [chips, setChips] = useState(initial.map(toChip))
  const [input, setInput] = useState('')
  const suggestions =
    input.length >= 2
      ? CONTACTS.filter(contact =>
          contact.label.toLowerCase().startsWith(input)
        )
      : []
  const add = (texts: string[]): void => {
    setChips(current => [
      ...current,
      ...texts.filter(text => text !== '').map(toChip)
    ])
    setInput('')
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') onEscape()
  }
  return (
    <div role="presentation" onKeyDown={handleKeyDown}>
      <RecipientField
        labels={LABELS}
        chips={chips}
        inputValue={input}
        onInputChange={setInput}
        onCommit={text => {
          add(text.split(/[,;\s]+/).map(part => part.trim()))
        }}
        onRemove={id => {
          setChips(current => current.filter(chip => chip.id !== id))
        }}
        onEdit={id => {
          setChips(current => current.filter(chip => chip.id !== id))
          setInput(id)
        }}
        suggestions={suggestions}
        onSelectSuggestion={id => {
          add([id])
        }}
        isList={text => /[,;\s]/.test(text.trim())}
        testIds={{ input: 'to-input', chip: 'chip' }}
      />
      <button type="button">Next field</button>
    </div>
  )
}

function chipNames(): string[] {
  return screen
    .queryAllByTestId('chip')
    .map(chip => chip.getAttribute('aria-label') ?? '')
}

describe('RecipientField', () => {
  it('is a combobox named by its visible label, in a group of the same name', () => {
    renderDs(<Harness />)

    expect(screen.getByRole('combobox', { name: 'To' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.getByRole('group', { name: 'To' })).toBeInTheDocument()
  })

  it('turns typed text into chips on Enter, a comma and leaving the field', async () => {
    renderDs(<Harness />)
    const input = screen.getByRole('combobox', { name: 'To' })

    await userEvent.type(input, 'bob@example.com{Enter}carol@example.com,')
    expect(chipNames()).toEqual(['bob@example.com', 'carol@example.com'])
    expect(input).toHaveValue('')

    await userEvent.type(input, 'dave@example.com')
    await userEvent.tab()
    expect(chipNames()).toEqual([
      'bob@example.com',
      'carol@example.com',
      'dave@example.com'
    ])
  })

  it('commits a pasted list at once', async () => {
    renderDs(<Harness />)
    const input = screen.getByRole('combobox', { name: 'To' })
    await userEvent.click(input)

    await userEvent.paste('erin@example.com, frank@example.com')
    expect(chipNames()).toEqual(['erin@example.com', 'frank@example.com'])
  })

  it('says an invalid chip is invalid in its name', () => {
    renderDs(<Harness initial={['not-an-address']} />)

    expect(chipNames()).toEqual(['not-an-address, invalid address'])
    expect(screen.getByTestId('chip')).toHaveAccessibleDescription(
      'Delete removes, Enter edits'
    )
  })

  it('reaches the chips from the input with the keyboard, removes and edits them', async () => {
    renderDs(<Harness initial={['a@example.com', 'b@example.com']} />)
    const input = screen.getByRole('combobox', { name: 'To' })
    await userEvent.click(input)

    await userEvent.keyboard('{Backspace}')
    const [first, second] = screen.getAllByTestId('chip')
    expect(second).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(first).toHaveFocus()

    await userEvent.keyboard('{Delete}')
    expect(chipNames()).toEqual(['b@example.com'])
    expect(screen.getByRole('status')).toHaveTextContent(
      'a@example.com removed'
    )
    expect(screen.getByTestId('chip')).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    expect(chipNames()).toEqual([])
    expect(input).toHaveValue('b@example.com')
    expect(input).toHaveFocus()
  })

  it('picks a suggestion with the arrows and Enter', async () => {
    renderDs(<Harness />)
    const input = screen.getByRole('combobox', { name: 'To' })

    await userEvent.type(input, 'al')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox', { name: 'Suggestions' })
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Albert/ }).id
    )

    await userEvent.keyboard('{Enter}')
    expect(chipNames()).toEqual(['albert@example.com'])
    expect(screen.queryByRole('listbox')).toBe(null)
  })

  it('closes the suggestions with Escape before letting Escape go', async () => {
    const onEscape = jest.fn()
    renderDs(<Harness onEscape={onEscape} />)
    const input = screen.getByRole('combobox', { name: 'To' })

    await userEvent.type(input, 'al')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBe(null)
    expect(onEscape).not.toHaveBeenCalled()

    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('takes the focus once shown when asked to', () => {
    renderDs(
      <RecipientField
        labels={LABELS}
        chips={[]}
        inputValue=""
        onInputChange={jest.fn()}
        onCommit={jest.fn()}
        onRemove={jest.fn()}
        onEdit={jest.fn()}
        suggestions={[]}
        onSelectSuggestion={jest.fn()}
        autoFocus
      />
    )

    expect(screen.getByRole('combobox', { name: 'To' })).toHaveFocus()
  })
})
