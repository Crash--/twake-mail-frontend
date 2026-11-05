import { Icon, Email } from '@linagora/twake-icons'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

/** jsdom has no PointerEvent: a mouse event that says its pointer type */
function pointer(
  element: HTMLElement,
  type: 'pointerdown' | 'pointermove',
  pointerType: 'touch' | 'mouse',
  clientY = 5
): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: 5, clientY })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  fireEvent(element, event)
}

describe('levelIndent', () => {
  it('moves each level 16 px further in, without a cap', () => {
    expect([1, 2, 3, 4, 10].map(levelIndent)).toEqual([0, 16, 32, 48, 144])
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

  it('is a container without `to`: no link, and a click on it toggles', async () => {
    const onToggle = jest.fn()
    renderItem({
      linkComponent: undefined,
      to: undefined,
      toggle: { label: 'Expand', isExpanded: false, onToggle }
    })

    expect(screen.queryByRole('link')).toBe(null)
    expect(screen.getAllByRole('button')).toEqual([
      screen.getByRole('button', { name: 'Expand' })
    ])
    await userEvent.click(screen.getByText('Inbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
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

  it('widens the expand target of touch screens to 44 px within the 36 px row, off the actions', () => {
    renderItem({
      toggle: { label: 'Expand', isExpanded: false, onToggle: jest.fn() },
      actions: <button type="button">Actions on Inbox</button>
    })

    expect(injectedCss()).toMatch(
      /@media\(pointer:coarse\),\(max-width:599\.95px\)\{\.css-[\w-]+\{width:44px;height:36px;padding:10px14px;margin:000-10px;\}/
    )
  })

  it('keeps the 36 px row of the design on touch screens', () => {
    renderItem()

    expect(injectedCss()).not.toMatch(
      /@media\(pointer:coarse\),\(max-width:599\.95px\)\{\.css-[\w-]+\{min-height:44px;\}/
    )
    expect(injectedCss()).toMatch(/min-height:36px;/)
  })

  it('marks the selected row', () => {
    renderItem({ isSelected: true })

    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveClass(
      'Mui-selected'
    )
  })

  it('opens the menu of a row a finger stays on, without following its link', () => {
    jest.useFakeTimers()
    const onLongPress = jest.fn<undefined, [HTMLElement]>()
    const onClick = jest.fn()
    renderItem({ onLongPress, itemProps: { role: 'treeitem', onClick } })
    const row = screen.getByRole('treeitem')

    pointer(row, 'pointerdown', 'touch')
    act(() => {
      jest.advanceTimersByTime(500)
    })
    fireEvent.pointerUp(row)
    fireEvent.click(screen.getByRole('link', { name: 'Inbox' }))

    expect(onLongPress).toHaveBeenCalledWith(row)
    expect(onClick).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('leaves a finger that scrolls, or a mouse, to the link', () => {
    jest.useFakeTimers()
    const onLongPress = jest.fn<undefined, [HTMLElement]>()
    renderItem({ onLongPress })
    const row = screen.getByRole('treeitem')

    pointer(row, 'pointerdown', 'touch')
    pointer(row, 'pointermove', 'touch', 40)
    pointer(row, 'pointerdown', 'mouse')
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(onLongPress).not.toHaveBeenCalled()
    jest.useRealTimers()
  })
})
