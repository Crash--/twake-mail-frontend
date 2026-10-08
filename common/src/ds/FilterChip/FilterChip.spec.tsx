import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Attachment } from '@/ds/FlutterIcons/FlutterIcons'
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
