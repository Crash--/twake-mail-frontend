import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { LabeledCheckbox } from './LabeledCheckbox'

describe('LabeledCheckbox', () => {
  it('is a checkbox named by its label, reporting its new state', async () => {
    const onChange = jest.fn()
    renderDs(
      <LabeledCheckbox label="Unread" checked={false} onChange={onChange} />
    )

    await userEvent.click(screen.getByRole('checkbox', { name: 'Unread' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('draws the checked box as large as the empty one', () => {
    const { container } = renderDs(
      <LabeledCheckbox label="Starred" checked onChange={jest.fn()} />
    )

    const icon = container.querySelector('svg.twake-icon')
    if (icon === null) throw new Error('No checked icon')
    const style = getComputedStyle(icon)
    expect([style.width, style.height, style.padding]).toEqual([
      '15px',
      '15px',
      '2.5px'
    ])
  })
})
