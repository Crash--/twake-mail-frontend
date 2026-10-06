import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react'

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
  removed: (label: string) => `${label} removed`,
  added: (labels: readonly string[]) =>
    labels.length === 1
      ? `${labels[0] ?? ''} added`
      : `${labels.length} recipients added`
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
  const edited = useRef<{ chip: RecipientFieldChip; index: number } | null>(
    null
  )
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
          const index = chips.findIndex(chip => chip.id === id)
          const chip = chips[index]
          if (chip) edited.current = { chip, index }
          setChips(current => current.filter(other => other.id !== id))
          setInput(id)
        }}
        onCancelEdit={() => {
          const previous = edited.current
          edited.current = null
          setInput('')
          if (previous === null) return
          setChips(current => [
            ...current.slice(0, previous.index),
            previous.chip,
            ...current.slice(previous.index)
          ])
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

  it('gives the chip back on Escape while it is edited, and stops there', async () => {
    const onEscape = jest.fn()
    renderDs(
      <Harness
        initial={['a@example.com', 'b@example.com', 'c@example.com']}
        onEscape={onEscape}
      />
    )
    const input = screen.getByRole('combobox', { name: 'To' })
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{Enter}')
    expect(input).toHaveValue('b@example.com')
    await userEvent.type(input, 'xyz')

    await userEvent.keyboard('{Escape}')
    expect(onEscape).not.toHaveBeenCalled()
    expect(chipNames()).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com'
    ])
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    // Restoring a chip is not adding one
    expect(screen.getByRole('status')).not.toHaveTextContent('added')

    // The second Escape is the window's
    await userEvent.keyboard('{Escape}')
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('closes the suggestions and gives the chip back with the same Escape', async () => {
    const onEscape = jest.fn()
    renderDs(<Harness initial={['al']} onEscape={onEscape} />)
    const input = screen.getByRole('combobox', { name: 'To' })
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowLeft}{Enter}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBe(null)
    expect(chipNames()).toEqual(['al, invalid address'])
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('lets Escape go once the edited text was committed', async () => {
    const onEscape = jest.fn()
    renderDs(<Harness initial={['a@example.com']} onEscape={onEscape} />)
    const input = screen.getByRole('combobox', { name: 'To' })
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowLeft}{Enter}{Enter}')
    expect(chipNames()).toEqual(['a@example.com'])

    await userEvent.keyboard('{Escape}')
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('announces the chips it gets, as it announces the ones it loses', async () => {
    renderDs(<Harness initial={['a@example.com']} />)
    const input = screen.getByRole('combobox', { name: 'To' })
    const status = screen.getByRole('status')
    // What was there at the start is not news
    expect(status).toHaveTextContent('')

    await userEvent.type(input, 'bob@example.com{Enter}')
    expect(status).toHaveTextContent('bob@example.com added')

    await userEvent.click(input)
    await userEvent.paste('erin@example.com, frank@example.com')
    expect(status).toHaveTextContent('2 recipients added')

    await userEvent.keyboard('{Backspace}{Delete}')
    expect(status).toHaveTextContent('frank@example.com removed')
  })

  it('caps the height of its chips and scrolls inside', () => {
    const many = Array.from({ length: 200 }, (_, index) => `u${index}@x.org`)
    renderDs(<Harness initial={many} />)

    const content = screen.getAllByTestId('chip')[0]?.parentElement
    if (!content) throw new Error('No chips')
    const style = getComputedStyle(content)
    expect(style.maxHeight).toBe('104px')
    expect(style.overflowY).toBe('auto')
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
        onCancelEdit={jest.fn()}
        suggestions={[]}
        onSelectSuggestion={jest.fn()}
        autoFocus
      />
    )

    expect(screen.getByRole('combobox', { name: 'To' })).toHaveFocus()
  })
})

describe('RecipientField avatar', () => {
  it('draws the letter of a chip with CSS: the name and the text stay the address', () => {
    renderDs(
      <RecipientField
        labels={LABELS}
        chips={[
          {
            id: 'alice@example.com',
            label: 'alice@example.com',
            isInvalid: false,
            avatar: 'alice@example.com'
          }
        ]}
        inputValue=""
        onInputChange={jest.fn()}
        onCommit={jest.fn()}
        onRemove={jest.fn()}
        onEdit={jest.fn()}
        onCancelEdit={jest.fn()}
        suggestions={[]}
        onSelectSuggestion={jest.fn()}
      />
    )

    const chip = screen.getByText('alice@example.com').closest('.MuiChip-root')
    expect(chip).toHaveTextContent(/^alice@example\.com$/)
    expect(chip?.querySelector('[data-letter="A"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })
})
