import { Email, Icon } from '@linagora/twake-icons'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { NavTreeItem } from '../NavTreeItem/NavTreeItem'
import { NavTree } from './NavTree'

interface Folder {
  id: string
  name: string
  level: number
  /** Undefined for a leaf */
  expanded?: boolean
  selected?: boolean
}

const FOLDERS: Folder[] = [
  { id: 'inbox', name: 'Inbox', level: 1, expanded: true },
  { id: 'work', name: 'Work', level: 2, expanded: false },
  { id: 'sub', name: 'Sub', level: 2 },
  { id: 'starred', name: 'Starred', level: 1 },
  { id: 'drafts', name: 'Drafts', level: 1 }
]

function Tree({
  folders,
  onOpen
}: {
  folders: Folder[]
  onOpen?: (id: string) => void
}): ReactElement {
  return (
    <>
      <button type="button">Before</button>
      <NavTree role="tree" aria-label="Folders">
        {folders.map(folder => (
          <NavTreeItem
            key={folder.id}
            level={folder.level}
            icon={<Icon icon={Email} />}
            label={folder.name}
            linkComponent="a"
            to={`#${folder.id}`}
            isSelected={folder.selected}
            toggle={
              folder.expanded === undefined
                ? undefined
                : {
                    label: `Toggle ${folder.name}`,
                    isExpanded: folder.expanded,
                    onToggle: () => {
                      onOpen?.(`toggle:${folder.id}`)
                    }
                  }
            }
            actions={<button type="button">Menu of {folder.name}</button>}
            itemProps={{
              role: 'treeitem',
              'aria-level': folder.level,
              'aria-selected': folder.selected === true,
              'aria-expanded': folder.expanded
            }}
          />
        ))}
      </NavTree>
      <button type="button">After</button>
    </>
  )
}

function item(name: string): HTMLElement {
  return screen.getByRole('treeitem', { name })
}

describe('NavTree', () => {
  it('has a single tab stop, on the first row', () => {
    renderDs(<Tree folders={FOLDERS} />)

    const stops = screen
      .getAllByRole('treeitem')
      .filter(row => row.getAttribute('tabindex') === '0')
    expect(stops).toEqual([item('Inbox')])
    // The links are for the pointer; the buttons of the other rows too
    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveAttribute(
      'tabindex',
      '-1'
    )
    expect(
      screen.getByRole('button', { name: 'Menu of Drafts' })
    ).toHaveAttribute('tabindex', '-1')
  })

  it('puts the tab stop on the selected row', () => {
    renderDs(
      <Tree
        folders={FOLDERS.map(folder =>
          folder.id === 'drafts' ? { ...folder, selected: true } : folder
        )}
      />
    )

    expect(item('Drafts')).toHaveAttribute('tabindex', '0')
    expect(item('Inbox')).toHaveAttribute('tabindex', '-1')
  })

  it('goes through the tree with one Tab, then its row buttons, then out', async () => {
    renderDs(<Tree folders={FOLDERS} />)

    await userEvent.click(screen.getByRole('button', { name: 'Before' }))
    await userEvent.tab()
    expect(item('Inbox')).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Toggle Inbox' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Menu of Inbox' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    await userEvent.tab({ shift: true })
    await userEvent.tab({ shift: true })
    expect(item('Inbox')).toHaveFocus()
  })

  it('moves with the arrows, Home and End, and stops at the ends', async () => {
    renderDs(<Tree folders={FOLDERS} />)
    await userEvent.tab()
    await userEvent.tab()
    item('Inbox').focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(item('Work')).toHaveFocus()
    expect(item('Work')).toHaveAttribute('tabindex', '0')
    expect(item('Inbox')).toHaveAttribute('tabindex', '-1')
    await userEvent.keyboard('{End}')
    expect(item('Drafts')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Drafts')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(item('Starred')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(item('Inbox')).toHaveFocus()
  })

  it('expands with ArrowRight, then goes to the first child', async () => {
    const onOpen = jest.fn()
    renderDs(<Tree folders={FOLDERS} onOpen={onOpen} />)
    item('Work').focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(onOpen).toHaveBeenCalledWith('toggle:work')

    item('Inbox').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(item('Work')).toHaveFocus()
  })

  it('collapses with ArrowLeft, then goes to the parent', async () => {
    const onOpen = jest.fn()
    renderDs(<Tree folders={FOLDERS} onOpen={onOpen} />)
    item('Inbox').focus()

    await userEvent.keyboard('{ArrowLeft}')
    expect(onOpen).toHaveBeenCalledWith('toggle:inbox')

    item('Sub').focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(item('Inbox')).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('opens the row with Enter, from the row only', async () => {
    renderDs(<Tree folders={FOLDERS} />)
    const link = screen.getByRole('link', { name: 'Starred' })
    const onClick = jest.fn((event: MouseEvent) => {
      event.preventDefault()
    })
    link.addEventListener('click', onClick)
    item('Starred').focus()

    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)

    // On a button of the row, Enter is the button's
    screen.getByRole('button', { name: 'Menu of Starred' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Drafts')).not.toHaveFocus()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('jumps to a row by the first letters of its name', async () => {
    renderDs(<Tree folders={FOLDERS} />)
    item('Inbox').focus()

    await userEvent.keyboard('dr')
    expect(item('Drafts')).toHaveFocus()
  })

  it('cycles through the rows starting with a letter typed again', async () => {
    renderDs(<Tree folders={FOLDERS} />)
    item('Inbox').focus()

    await userEvent.keyboard('s')
    expect(item('Sub')).toHaveFocus()
    await userEvent.keyboard('s')
    expect(item('Starred')).toHaveFocus()
  })

  it('hands the focus of a click on a link to its row', async () => {
    renderDs(<Tree folders={FOLDERS} />)

    await userEvent.click(screen.getByRole('link', { name: 'Drafts' }))
    expect(item('Drafts')).toHaveFocus()
    expect(item('Drafts')).toHaveAttribute('tabindex', '0')
  })

  it('does not take the keys of a plain list', () => {
    renderDs(
      <NavTree>
        <NavTreeItem
          level={1}
          icon={<Icon icon={Email} />}
          label="Label"
          linkComponent="a"
          to="#label"
        />
      </NavTree>
    )

    expect(screen.getByRole('link', { name: 'Label' })).not.toHaveAttribute(
      'tabindex',
      '-1'
    )
  })

  it('gives the focus to the row that takes the place of the one removed', async () => {
    function Removable(): ReactElement {
      const [folders, setFolders] = useState(FOLDERS)
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setFolders(previous => previous.filter(f => f.id !== 'starred'))
            }}
          >
            Remove
          </button>
          <Tree folders={folders} />
        </>
      )
    }
    renderDs(<Removable />)
    act(() => {
      item('Starred').focus()
    })

    // The focus is in the tree when the row goes (a push, a delete)
    const remove = screen.getByRole('button', { name: 'Remove' })
    act(() => {
      remove.click()
    })

    expect(screen.queryByRole('treeitem', { name: 'Starred' })).toBe(null)
    await waitFor(() => {
      expect(item('Drafts')).toHaveFocus()
    })
    expect(item('Drafts')).toHaveAttribute('tabindex', '0')
  })
})
