import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ColorSwatchPicker } from './ColorSwatchPicker'

const SWATCHES = [
  { value: '#273891', label: 'Indigo' },
  { value: '#7E57E3', label: 'Violet' }
]

describe('ColorSwatchPicker', () => {
  it('is a named radio group, moved with the arrows', async () => {
    const onChange = jest.fn()
    renderDs(
      <ColorSwatchPicker
        legend="Choose a color"
        swatches={SWATCHES}
        value="#273891"
        onChange={onChange}
        noneLabel="No color"
      />
    )

    expect(screen.getByRole('group', { name: 'Choose a color' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Indigo' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Violet' }))
    expect(onChange).toHaveBeenLastCalledWith('#7E57E3')
    await userEvent.click(screen.getByRole('radio', { name: 'No color' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
