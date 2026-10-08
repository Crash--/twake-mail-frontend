import { Icon } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Email } from '@/ds/FlutterIcons/FlutterIcons'
import { injectedCss } from '@/ds/testing/injectedCss'
import { renderDs } from '@/ds/testing/renderDs'

import { levelIndent, NavTreeItem, type NavTreeItemProps } from './NavTreeItem'

function renderItem(props: Partial<NavTreeItemProps> = {}): void {
  renderDs(
    <ul role="tree">
      <NavTreeItem
        level={1}
        icon={<Icon icon={Email} />}
        label="Inbox"
        linkComponent="a"
        to="/inbox"
        itemProps={{ role: 'treeitem' }}
        {...props}
      />
    </ul>
  )
}

describe('levelIndent', () => {
  it('indents by 8, 44, 52, then 8 more per level, without a cap', () => {
    expect([1, 2, 3, 4, 10].map(levelIndent)).toEqual([8, 44, 52, 60, 108])
  })
})

describe('NavTreeItem', () => {
  it('links to the folder, named by its label and its count text', () => {
    renderItem({ countText: '6', count: <span aria-hidden>6</span> })

    expect(screen.getByRole('link', { name: 'Inbox 6' })).toHaveAttribute(
      'href',
      '/inbox'
    )
  })

  it('shows a second line under the name, part of the name of the link', () => {
    renderItem({ secondary: 'Work/Clients' })

    expect(
      screen.getByRole('link', { name: 'Inbox Work/Clients' })
    ).toBeVisible()
  })

  it('has no expand control without children', () => {
    renderItem()

    expect(screen.queryByRole('button')).toBe(null)
  })

  it('has a named expand control of its own, operable with the keyboard', async () => {
    const onToggle = jest.fn()
    renderItem({
      toggle: { label: 'Expand', isExpanded: false, onToggle }
    })

    const link = screen.getByRole('link', { name: 'Inbox' })
    const toggle = screen.getByRole('button', { name: 'Expand' })
    expect(link).not.toContainElement(toggle)

    await userEvent.tab()
    expect(link).toHaveFocus()
    await userEvent.tab()
    expect(toggle).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onToggle).toHaveBeenCalledTimes(2)
  })

  it('keeps the actions reachable by keyboard', async () => {
    renderItem({
      actions: <button type="button">Actions on Inbox</button>
    })

    await userEvent.tab()
    await userEvent.tab()

    expect(
      screen.getByRole('button', { name: 'Actions on Inbox' })
    ).toHaveFocus()
  })

  it('cuts the text after the name before the name itself', () => {
    renderItem({ meta: <span>team@example.com</span> })

    expect(screen.getByText('team@example.com').parentElement).toHaveAttribute(
      'data-nav-meta'
    )
    expect(injectedCss()).toMatch(/\{min-width:0;[^}]*flex:01000auto;\}/)
  })

  it('keeps the 44 px expand target of touch screens off the actions', () => {
    renderItem({
      toggle: { label: 'Expand', isExpanded: false, onToggle: jest.fn() },
      actions: <button type="button">Actions on Inbox</button>
    })

    expect(injectedCss()).toMatch(
      /@media\(pointer:coarse\),\(max-width:599\.95px\)\{\.css-[\w-]+\{width:44px;height:44px;padding:14px;margin:000-10px;\}/
    )
  })

  it('marks the selected row', () => {
    renderItem({ isSelected: true })

    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveClass(
      'Mui-selected'
    )
  })
})
