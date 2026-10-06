import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  SearchCombobox,
  type SearchComboboxGroup,
  type SearchComboboxProps
} from './SearchCombobox'

const GROUPS: SearchComboboxGroup[] = [
  {
    id: 'recent',
    label: 'Recent',
    options: [{ id: 'r1', label: 'invoice' }]
  },
  {
    id: 'emails',
    label: 'Messages',
    options: [
      { id: 'e1', label: 'Quarterly report', secondary: 'Alice' },
      { id: 'e2', label: 'Weekly report' }
    ]
  }
]

type Handlers = Pick<SearchComboboxProps, 'onSubmit' | 'onSelect'>

function Harness({
  onSubmit,
  onSelect,
  onPageEscape
}: Handlers & { onPageEscape: () => void }): ReactElement {
  const [value, setValue] = useState('')
  const [isPressed, setIsPressed] = useState(false)
  return (
    // The page around the field: Escape folds the search there
    <div
      onKeyDown={event => {
        if (event.key === 'Escape') onPageEscape()
      }}
    >
      <SearchCombobox
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        onSelect={onSelect}
        groups={GROUPS}
        header={
          <button
            type="button"
            aria-pressed={isPressed}
            onMouseDown={event => {
              event.preventDefault()
            }}
            onClick={() => {
              setIsPressed(!isPressed)
            }}
          >
            Has attachment
          </button>
        }
        label="Search emails"
        listLabel="Suggestions"
        clearLabel="Clear search"
        status="3 suggestions"
      />
      <button type="button">Elsewhere</button>
    </div>
  )
}

function setup(): {
  onSubmit: jest.Mock
  onSelect: jest.Mock
  onPageEscape: jest.Mock
} {
  const handlers = {
    onSubmit: jest.fn(),
    onSelect: jest.fn(),
    onPageEscape: jest.fn()
  }
  renderDs(<Harness {...handlers} />)
  return handlers
}

describe('SearchCombobox', () => {
  it('is a combobox controlling a listbox, closed until focused', async () => {
    setup()
    const input = screen.getByRole('combobox', { name: 'Search emails' })

    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBe(null)

    await userEvent.click(input)

    const listbox = screen.getByRole('listbox', { name: 'Suggestions' })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(
      within(listbox).getByRole('group', { name: 'Messages' })
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('3 suggestions')
  })

  it('moves the active option with the arrows and picks it with Enter', async () => {
    const { onSelect, onSubmit } = setup()
    const input = screen.getByRole('combobox', { name: 'Search emails' })
    await userEvent.click(input)

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')

    const active = screen.getByRole('option', { name: /Quarterly report/ })
    expect(input).toHaveAttribute('aria-activedescendant', active.id)
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Weekly report' }).id
    )

    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBe(null)
  })

  it('submits the text with Enter when no option is active', async () => {
    const { onSubmit, onSelect } = setup()

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search emails' }),
      'report{Enter}'
    )

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('picks an option with a click', async () => {
    const { onSelect } = setup()
    await userEvent.click(screen.getByRole('combobox'))

    await userEvent.click(screen.getByRole('option', { name: 'invoice' }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }))
  })

  it('closes on Escape first, then lets Escape reach the page', async () => {
    const { onPageEscape } = setup()
    await userEvent.click(screen.getByRole('combobox'))

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBe(null)
    expect(onPageEscape).not.toHaveBeenCalled()

    await userEvent.keyboard('{Escape}')
    expect(onPageEscape).toHaveBeenCalledTimes(1)
  })

  it('keeps the focus in the field when the header is clicked', async () => {
    setup()
    const input = screen.getByRole('combobox')
    await userEvent.click(input)

    await userEvent.click(
      screen.getByRole('button', { name: 'Has attachment' })
    )

    expect(
      screen.getByRole('button', { name: 'Has attachment' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(input).toHaveFocus()
    expect(screen.getByRole('listbox')).toBeVisible()
  })

  it('reaches the header with Tab, and closes when the focus leaves', async () => {
    setup()
    await userEvent.click(screen.getByRole('combobox'))

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Has attachment' })).toHaveFocus()
    expect(screen.getByRole('listbox')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(screen.queryByRole('listbox')).toBe(null)
  })

  it('clears the text with a named button', async () => {
    setup()
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'report')

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
  })

  it('focuses the field on a right click', async () => {
    setup()
    const input = screen.getByRole('combobox')

    await userEvent.pointer({ keys: '[MouseRight]', target: input })

    expect(input).toHaveFocus()
  })

  it('stays collapsed, without a listbox, when only the header is shown', async () => {
    renderDs(
      <SearchCombobox
        value=""
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onSelect={jest.fn()}
        groups={[{ id: 'recent', label: 'Recent', options: [] }]}
        header={<button type="button">Has attachment</button>}
        label="Search emails"
        listLabel="Suggestions"
        clearLabel="Clear search"
        status="Only filters"
      />
    )
    const input = screen.getByRole('combobox', { name: 'Search emails' })

    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}')

    expect(screen.getByRole('button', { name: 'Has attachment' })).toBeVisible()
    expect(screen.queryByRole('listbox')).toBe(null)
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).not.toHaveAttribute('aria-controls')
    expect(input).not.toHaveAttribute('aria-activedescendant')
    expect(screen.getByRole('status')).toHaveTextContent('Only filters')
  })

  it('keeps the name of a group whose heading is hidden, and hides the end of a row', async () => {
    renderDs(
      <SearchCombobox
        value="re"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onSelect={jest.fn()}
        groups={[
          {
            id: 'emails',
            label: 'Messages',
            isLabelHidden: true,
            options: [
              { id: 'e1', label: 'Quarterly report', end: <span>Jun 29</span> }
            ]
          }
        ]}
        label="Search emails"
        listLabel="Suggestions"
        clearLabel="Clear search"
      />
    )
    await userEvent.click(
      screen.getByRole('combobox', { name: 'Search emails' })
    )

    expect(screen.getByRole('group', { name: 'Messages' })).toBeInTheDocument()
    expect(screen.getByText('Messages')).toHaveClass('u-visuallyhidden')
    expect(
      screen.getByRole('option', { name: 'Quarterly report' })
    ).toBeInTheDocument()
  })
})
