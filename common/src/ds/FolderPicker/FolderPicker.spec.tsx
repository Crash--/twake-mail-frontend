import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { FolderPicker, type FolderPickerSection } from './FolderPicker'

const LABELS = {
  title: 'Move To',
  close: 'Close',
  search: 'Search folders',
  empty: 'No folder',
  collapsed: 'subfolders hidden',
  expanded: 'subfolders shown',
  current: 'current folder'
}

const SECTIONS: FolderPickerSection[] = [
  {
    id: 'system',
    label: null,
    options: [
      {
        id: 'inbox',
        label: 'Inbox',
        level: 1,
        parentId: null,
        hasChildren: false,
        isCurrent: true
      },
      {
        id: 'sent',
        label: 'Sent',
        level: 1,
        parentId: null,
        hasChildren: false
      }
    ]
  },
  {
    id: 'personal',
    label: 'Personal folders',
    options: [
      {
        id: 'projects',
        label: 'Projects',
        secondary: 'Projects',
        level: 1,
        parentId: null,
        hasChildren: true
      },
      {
        id: 'alpha',
        label: 'Alpha',
        secondary: 'Projects/Alpha',
        level: 2,
        parentId: 'projects',
        hasChildren: false
      }
    ]
  }
]

function renderPicker(onSelect = jest.fn()): jest.Mock {
  renderDs(
    <FolderPicker
      open
      labels={LABELS}
      sections={SECTIONS}
      onSelect={onSelect}
      onClose={jest.fn()}
    />
  )
  return onSelect
}

describe('FolderPicker', () => {
  it('is a named dialog, the focus in its search, the current folder not pickable', async () => {
    renderPicker()

    const dialog = screen.getByRole('dialog', { name: 'Move To' })
    const search = within(dialog).getByRole('combobox', {
      name: 'Search folders'
    })
    await waitFor(() => {
      expect(search).toHaveFocus()
    })
    const inbox = within(dialog).getByRole('option', { name: 'Inbox' })
    expect(inbox).toHaveAttribute('aria-disabled', 'true')
    expect(inbox).toHaveAccessibleDescription('current folder')
    // Subfolders are folded, as tmail-flutter
    expect(within(dialog).queryByRole('option', { name: 'Alpha' })).toBe(null)
    expect(
      within(dialog).getByRole('option', { name: 'Projects' })
    ).toHaveAccessibleDescription('subfolders hidden')
  })

  it('moves with the arrows, unfolds with ArrowRight and picks with Enter', async () => {
    const onSelect = renderPicker()
    const search = screen.getByRole('combobox', { name: 'Search folders' })
    await waitFor(() => {
      expect(search).toHaveFocus()
    })

    // The current folder is skipped: Sent, then Projects
    await userEvent.keyboard('{ArrowDown}')
    expect(search).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Sent' }).id
    )
    await userEvent.keyboard('{ArrowDown}{ArrowRight}')
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeVisible()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'alpha' })
    )
  })

  it('folds a block from its header, and searches every folder', async () => {
    renderPicker()
    const header = screen.getByRole('button', { name: 'Personal folders' })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('option', { name: 'Projects' })).toBe(null)

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search folders' }),
      'alp'
    )
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option', { name: /^Alpha/ })).toBeVisible()
  })
})
