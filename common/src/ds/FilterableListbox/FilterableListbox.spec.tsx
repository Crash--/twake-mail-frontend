import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import {
  FilterableListbox,
  type FilterableListboxOption
} from './FilterableListbox'

const OPTIONS: FilterableListboxOption[] = [
  { id: 'inbox', label: 'Inbox', disabled: true },
  { id: 'work', label: 'Work', secondary: 'Work' },
  { id: 'clients', label: 'Clients', secondary: 'Work/Clients', level: 2 },
  { id: 'archive', label: 'Archive', secondary: 'Archive' }
]

function renderList(onSelect = jest.fn()): jest.Mock {
  renderDs(
    <FilterableListbox
      options={OPTIONS}
      onSelect={onSelect}
      filterLabel="Search folders"
      listLabel="Folders"
      emptyLabel="No folder"
    />
  )
  return onSelect
}

describe('FilterableListbox', () => {
  it('keeps the focus in the field and moves the active option with the arrows', async () => {
    const onSelect = renderList()
    const field = screen.getByRole('combobox', { name: 'Search folders' })

    expect(field).toHaveFocus()
    // The first enabled option is active, the disabled one is skipped
    expect(field).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Work' }).id
    )
    expect(screen.getByRole('option', { name: 'Inbox' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Clients' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(screen.getByRole('option', { name: 'Archive' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await userEvent.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith(OPTIONS[3])
  })

  it('filters on the label and the path, accents and case aside', async () => {
    const onSelect = renderList()

    await userEvent.keyboard('work cli')

    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(
      screen.getByRole('option', { name: 'Clients Work/Clients' })
    ).toBeVisible()
    await userEvent.click(screen.getByRole('option', { name: /Clients/ }))
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[2])

    await userEvent.clear(screen.getByRole('combobox'))
    await userEvent.keyboard('nothing')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('No folder')
  })

  it('does not select a disabled option', async () => {
    const onSelect = renderList()

    await userEvent.click(screen.getByRole('option', { name: 'Inbox' }), {
      pointerEventsCheck: 0
    })

    expect(onSelect).not.toHaveBeenCalled()
  })
})
