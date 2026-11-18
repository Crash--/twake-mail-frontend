import { Attachment, Check } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { FilterChip } from './FilterChip'

describe('FilterChip', () => {
  it('is a toggle: pressed when applied, the whole chip clicks', async () => {
    const onClick = jest.fn()
    renderDs(
      <FilterChip
        label="Has attachment"
        icon={Attachment}
        isSelected
        onClick={onClick}
      />
    )

    const chip = screen.getByRole('button', { name: 'Has attachment' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(chip)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('centres a smaller icon in its 16 px slot, the label where it was', () => {
    renderDs(
      <FilterChip
        label="Starred"
        icon={Attachment}
        iconSize={13}
        isSelected={false}
        popup="menu"
        onClick={jest.fn()}
      />
    )

    const chip = screen.getByRole('button', { name: 'Starred' })
    const icon = chip.querySelector('.MuiChip-icon')
    expect(icon).toHaveAttribute('width', '13')
    // 12 px before the slot, 4 px after it, in whole pixels: 1 px before the
    // icon, 2 after, so that the label stays in place
    expect(icon).toHaveStyle({ marginLeft: '13px', marginRight: '-6px' })
    expect(chip.querySelector('.MuiChip-label svg')).toHaveAttribute(
      'width',
      '12'
    )
  })

  it('draws the check of an applied filter at one size, whatever its icon', () => {
    renderDs(
      <>
        <FilterChip
          label="Starred"
          icon={Attachment}
          iconSize={14}
          selectedIcon={Check}
          isSelected
          onClick={jest.fn()}
        />
        <FilterChip
          label="Unread"
          icon={Attachment}
          iconSize={13}
          selectedIcon={Check}
          isSelected
          onClick={jest.fn()}
        />
      </>
    )

    const widthOf = (name: string): string | null | undefined =>
      screen
        .getByRole('button', { name })
        .querySelector('.MuiChip-icon')
        ?.getAttribute('width')
    expect(widthOf('Starred')).toBe(widthOf('Unread'))
  })

  it('spaces its icon, caption label and chevron as Teammail 1.1', () => {
    renderDs(
      <>
        <FilterChip
          label="Starred"
          icon={Attachment}
          isSelected={false}
          onClick={jest.fn()}
        />
        <FilterChip
          label="All time"
          icon={Attachment}
          isSelected={false}
          popup="menu"
          onClick={jest.fn()}
        />
      </>
    )

    const parts = (name: string): [Element | null, Element | null] => {
      const chip = screen.getByRole('button', { name })
      return [
        chip.querySelector('.MuiChip-icon'),
        chip.querySelector('.MuiChip-label')
      ]
    }
    const [icon, label] = parts('Starred')
    expect(icon).toHaveStyle({ marginLeft: '12px', marginRight: '-8px' })
    expect(label).toHaveStyle({ fontWeight: '500', paddingRight: '12px' })
    expect(parts('All time')[1]).toHaveStyle({ paddingRight: '8px' })
  })

  it('draws its applied icon once applied', () => {
    const iconPath = (isSelected: boolean): string | null => {
      const { container, unmount } = renderDs(
        <FilterChip
          label="Has attachment"
          icon={Attachment}
          selectedIcon={Check}
          isSelected={isSelected}
          onClick={jest.fn()}
        />
      )
      const path = container.querySelector('path')?.getAttribute('d') ?? null
      unmount()
      return path
    }

    expect(iconPath(true)).not.toBe(iconPath(false))
    expect(iconPath(true)).toMatch(/^M5.88 10.23/)
  })

  it('opens a menu rather than toggling when it has one', () => {
    renderDs(
      <FilterChip
        label="All time"
        isSelected={false}
        popup="menu"
        isExpanded
        onClick={jest.fn()}
      />
    )

    const chip = screen.getByRole('button', { name: 'All time' })
    expect(chip).toHaveAttribute('aria-haspopup', 'menu')
    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(chip).not.toHaveAttribute('aria-pressed')
  })

  it('keeps the focus where it is when asked to', async () => {
    renderDs(
      <>
        <input aria-label="Field" />
        <FilterChip
          label="Starred"
          isSelected={false}
          keepFocus
          onClick={jest.fn()}
        />
      </>
    )
    await userEvent.click(screen.getByRole('textbox', { name: 'Field' }))

    await userEvent.click(screen.getByRole('button', { name: 'Starred' }))

    expect(screen.getByRole('textbox', { name: 'Field' })).toHaveFocus()
  })

  it('says a form opens, and is a plain button when removable', () => {
    renderDs(
      <>
        <FilterChip
          label="From"
          isSelected
          popup="dialog"
          onClick={jest.fn()}
        />
        <FilterChip label="Remove" isSelected isRemovable onClick={jest.fn()} />
      </>
    )

    expect(screen.getByRole('button', { name: 'From' })).toHaveAttribute(
      'aria-haspopup',
      'dialog'
    )
    expect(screen.getByRole('button', { name: 'Remove' })).not.toHaveAttribute(
      'aria-pressed'
    )
  })
})
