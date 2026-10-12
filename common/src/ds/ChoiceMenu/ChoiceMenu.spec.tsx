import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ChoiceMenu } from './ChoiceMenu'

describe('ChoiceMenu', () => {
  it('lists exclusive choices, the chosen one checked and marked', async () => {
    const onSelect = jest.fn()
    const onClose = jest.fn()
    const anchor = document.createElement('button')
    document.body.append(anchor)
    renderDs(
      <ChoiceMenu
        anchorEl={anchor}
        onClose={onClose}
        items={[
          { key: 'all', label: 'All labels', isSelected: true, onSelect },
          { key: 'work', label: 'Work', isSelected: false, onSelect }
        ]}
      />
    )

    const all = screen.getByRole('menuitemradio', { name: 'All labels' })
    const work = screen.getByRole('menuitemradio', { name: 'Work' })
    expect(all).toHaveAttribute('aria-checked', 'true')
    expect(work).toHaveAttribute('aria-checked', 'false')
    expect(all.querySelector('svg')).not.toBe(null)
    expect(work.querySelector('svg')).toBe(null)

    await userEvent.click(work)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('shows nothing without an anchor', () => {
    renderDs(<ChoiceMenu anchorEl={null} onClose={jest.fn()} items={[]} />)

    expect(screen.queryByRole('menu')).toBe(null)
  })
})
