import { Attachment } from '@linagora/twake-icons'
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

  it('opens a menu rather than toggling when it has one', () => {
    renderDs(
      <FilterChip
        label="All time"
        isSelected={false}
        hasMenu
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
})
