import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { RecipientField, type RecipientFieldChip } from './RecipientField'

const LABELS = {
  suggestions: 'Suggestions',
  alreadyAdded: 'already added',
  invalid: 'invalid address',
  chipHelp: 'Delete removes it',
  removed: (label: string) => `${label} removed`,
  added: (labels: readonly string[]) => `${labels.join(', ')} added`
}

const EMAILS_TYPE = 'application/x-emails'

/** What the browser hands to the drag events, shared by one drag */
function makeDataTransfer(): DataTransfer {
  const data = new Map<string, string>()
  const transfer = {
    dropEffect: 'none',
    effectAllowed: 'all',
    get types() {
      return [...data.keys()]
    },
    setData: (type: string, value: string) => {
      data.set(type, value)
    },
    getData: (type: string) => data.get(type) ?? '',
    setDragImage: jest.fn()
  }
  // Only what the field reads of it
  return transfer as Partial<DataTransfer> as DataTransfer
}

function toChip(text: string): RecipientFieldChip {
  return { id: text, label: text, isInvalid: false, avatar: text }
}

/** To and Cc of one composer, moving tags as tmail-flutter */
function Harness({
  group = 'composer',
  onDropEmails = jest.fn()
}: {
  group?: string
  onDropEmails?: (dataTransfer: DataTransfer) => void
}): ReactElement {
  const [lists, setLists] = useState<Record<string, string[]>>({
    to: ['alice@example.com', 'bob@example.com'],
    cc: ['bob@example.com']
  })
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const kinds = ['to', 'cc']
  const move = (from: string, to: string, id: string): void => {
    setLists(current => ({
      ...current,
      [to]: (current[to] ?? []).includes(id)
        ? (current[to] ?? [])
        : [...(current[to] ?? []), id],
      [from]: (current[from] ?? []).filter(other => other !== id)
    }))
  }
  return (
    <>
      {kinds.map(kind => (
        <RecipientField
          key={kind}
          labels={{ ...LABELS, field: kind === 'to' ? 'To' : 'Cc' }}
          chips={(lists[kind] ?? []).map(toChip)}
          inputValue={inputs[kind] ?? ''}
          onInputChange={value => {
            setInputs(current => ({ ...current, [kind]: value }))
          }}
          onCommit={text => {
            setInputs(current => ({ ...current, [kind]: '' }))
            setLists(current => ({
              ...current,
              [kind]: [...(current[kind] ?? []), text]
            }))
          }}
          onRemove={jest.fn()}
          onEdit={jest.fn()}
          onCancelEdit={jest.fn()}
          suggestions={[]}
          onSelectSuggestion={jest.fn()}
          dnd={{
            group,
            field: kind,
            onMoveIn: (from, id) => {
              move(from, kind, id)
              return `${id} moved to ${kind}`
            },
            onMoveBy: (id, delta) => {
              const target = kinds[kinds.indexOf(kind) + delta]
              if (target === undefined) return null
              move(kind, target, id)
              return `${id} moved to ${target}`
            },
            accepts: types => types.includes(EMAILS_TYPE),
            onDrop: onDropEmails
          }}
          testIds={{ field: `${kind}-field`, chip: `${kind}-chip` }}
        />
      ))}
    </>
  )
}

function chipsOf(kind: string): string[] {
  return screen
    .queryAllByTestId(`${kind}-chip`)
    .map(chip => chip.getAttribute('aria-label') ?? '')
}

function statusOf(kind: string): HTMLElement {
  return within(screen.getByTestId(`${kind}-field`)).getByRole('status')
}

function drag(chip: HTMLElement, target: HTMLElement): void {
  const dataTransfer = makeDataTransfer()
  fireEvent.dragStart(chip, { dataTransfer })
  fireEvent.dragEnter(target, { dataTransfer })
  fireEvent.dragOver(target, { dataTransfer })
  expect(target).toHaveAttribute('data-drop-over', 'true')
  fireEvent.drop(target, { dataTransfer })
  fireEvent.dragEnd(chip, { dataTransfer })
}

describe('RecipientField drag and drop', () => {
  it('moves a tag dropped on another field of its group, as tmail-flutter', () => {
    renderDs(<Harness />)
    const alice = screen.getAllByTestId('to-chip')[0]
    if (!alice) throw new Error('No tag')

    expect(alice).toHaveAttribute('draggable', 'true')
    drag(alice, screen.getByTestId('cc-field'))

    expect(chipsOf('to')).toEqual(['bob@example.com'])
    expect(chipsOf('cc')).toEqual(['bob@example.com', 'alice@example.com'])
    expect(screen.getByTestId('cc-field')).not.toHaveAttribute('data-drop-over')
  })

  it('merges a tag already in the target: it leaves its field anyway', () => {
    renderDs(<Harness />)
    const bob = screen.getAllByTestId('to-chip')[1]
    if (!bob) throw new Error('No tag')

    drag(bob, screen.getByTestId('cc-field'))

    expect(chipsOf('to')).toEqual(['alice@example.com'])
    expect(chipsOf('cc')).toEqual(['bob@example.com'])
  })

  it('refuses a tag on its own field', () => {
    renderDs(<Harness />)
    const alice = screen.getAllByTestId('to-chip')[0]
    if (!alice) throw new Error('No tag')
    const dataTransfer = makeDataTransfer()
    const field = screen.getByTestId('to-field')

    fireEvent.dragStart(alice, { dataTransfer })
    fireEvent.dragEnter(field, { dataTransfer })
    fireEvent.drop(field, { dataTransfer })
    fireEvent.dragEnd(alice, { dataTransfer })

    expect(field).not.toHaveAttribute('data-drop-over')
    expect(chipsOf('to')).toEqual(['alice@example.com', 'bob@example.com'])
  })

  it('hands other accepted things dropped on the field to the caller', () => {
    const onDropEmails = jest.fn()
    renderDs(<Harness onDropEmails={onDropEmails} />)
    const field = screen.getByTestId('cc-field')
    const dataTransfer = makeDataTransfer()
    dataTransfer.setData(EMAILS_TYPE, '["e1"]')

    fireEvent.dragEnter(field, { dataTransfer })
    expect(field).toHaveAttribute('data-drop-over', 'true')
    fireEvent.drop(field, { dataTransfer })

    expect(onDropEmails).toHaveBeenCalledWith(dataTransfer)
    expect(field).not.toHaveAttribute('data-drop-over')
  })

  it('moves a tag from the keyboard with Alt and the arrows, and says so', async () => {
    renderDs(<Harness />)
    const alice = screen.getAllByTestId('to-chip')[0]
    if (!alice) throw new Error('No tag')
    act(() => {
      alice.focus()
    })

    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')

    expect(chipsOf('to')).toEqual(['bob@example.com'])
    expect(chipsOf('cc')).toEqual(['bob@example.com', 'alice@example.com'])
    expect(statusOf('to')).toHaveTextContent('alice@example.com moved to cc')
    // Once: the field it joins does not say it was added
    expect(statusOf('cc')).toHaveTextContent('')
    // The moved tag keeps the focus, in the field it joined
    expect(screen.getAllByTestId('cc-chip')[1]).toHaveFocus()

    // Nothing below Cc: it stays there, focused
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(chipsOf('cc')).toEqual(['bob@example.com', 'alice@example.com'])
    expect(screen.getAllByTestId('cc-chip')[1]).toHaveFocus()
  })

  it('moves the same tag again on a second Alt + arrow', async () => {
    renderDs(<Harness />)
    const alice = screen.getAllByTestId('to-chip')[0]
    if (!alice) throw new Error('No tag')
    act(() => {
      alice.focus()
    })
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(screen.getAllByTestId('cc-chip')[1]).toHaveFocus()
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')

    // alice went back to To; bob, never selected, stayed in Cc
    expect(chipsOf('to')).toEqual(['bob@example.com', 'alice@example.com'])
    expect(chipsOf('cc')).toEqual(['bob@example.com'])
    expect(screen.getAllByTestId('to-chip')[1]).toHaveFocus()
  })

  it('focuses the tag already in the field a tag moves to', async () => {
    renderDs(<Harness />)
    const bob = screen.getAllByTestId('to-chip')[1]
    if (!bob) throw new Error('No tag')
    act(() => {
      bob.focus()
    })

    // bob is already in Cc: the field it joins focuses its own tag
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')

    expect(chipsOf('to')).toEqual(['alice@example.com'])
    expect(chipsOf('cc')).toEqual(['bob@example.com'])
    expect(screen.getAllByTestId('cc-chip')[0]).toHaveFocus()
  })

  it('says a dropped tag moved, once, in the field it joins', async () => {
    renderDs(<Harness />)
    const alice = screen.getAllByTestId('to-chip')[0]
    if (!alice) throw new Error('No tag')
    act(() => {
      alice.focus()
    })
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    const moved = screen.getAllByTestId('cc-chip')[1]
    if (!moved) throw new Error('No tag')

    drag(moved, screen.getByTestId('to-field'))

    expect(chipsOf('to')).toEqual(['bob@example.com', 'alice@example.com'])
    expect(statusOf('to')).toHaveTextContent('alice@example.com moved to to')
    expect(statusOf('cc')).toHaveTextContent('')
  })

  it('says an address typed after a move was added', async () => {
    renderDs(<Harness />)
    const alice = screen.getAllByTestId('to-chip')[0]
    if (!alice) throw new Error('No tag')
    act(() => {
      alice.focus()
    })
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')

    await userEvent.type(
      within(screen.getByTestId('to-field')).getByRole('combobox'),
      'alice@example.com{Enter}'
    )

    expect(chipsOf('to')).toEqual(['bob@example.com', 'alice@example.com'])
    expect(statusOf('to')).toHaveTextContent('alice@example.com added')
  })
})
