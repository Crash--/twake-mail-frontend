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
          inputValue=""
          onInputChange={jest.fn()}
          onCommit={jest.fn()}
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
    expect(
      within(screen.getByTestId('to-field')).getByRole('status')
    ).toHaveTextContent('alice@example.com moved to cc')
    // The next tag of the field takes the focus, as after a removal
    expect(screen.getAllByTestId('to-chip')[0]).toHaveFocus()

    // Nothing above To
    const bob = screen.getAllByTestId('to-chip')[0]
    if (!bob) throw new Error('No tag')
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(chipsOf('to')).toEqual(['bob@example.com'])
    expect(bob).toHaveFocus()
  })
})
