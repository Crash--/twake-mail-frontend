import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { ColorPopoverPicker } from './ColorPopoverPicker'

const SWATCHES = [
  { value: '#273891', label: 'Indigo' },
  { value: '#7E57E3', label: 'Violet' }
]

function Picker({ onCustom }: { onCustom: () => void }): ReactElement {
  const [value, setValue] = useState<string | null>(null)
  return (
    <ColorPopoverPicker
      buttonLabel={`Color: ${value ?? 'none'}`}
      groupLabel="Choose a color"
      swatches={SWATCHES}
      value={value}
      noneLabel="No color"
      customLabel="Custom color"
      isCustom={false}
      onChange={setValue}
      onCustom={onCustom}
    />
  )
}

describe('ColorPopoverPicker', () => {
  it('opens the colours as a radio group, a click picks one and closes', async () => {
    renderDs(<Picker onCustom={jest.fn()} />)

    const button = screen.getByRole('button', { name: 'Color: none' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)

    const group = await screen.findByRole('radiogroup', {
      name: 'Choose a color'
    })
    expect(screen.getByRole('radio', { name: 'No color' })).toBeChecked()
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'No color' })).toHaveFocus()
    })
    expect(group).toBeVisible()

    await userEvent.click(screen.getByRole('radio', { name: 'Violet' }))

    await waitFor(() => {
      expect(screen.queryByRole('radiogroup')).toBe(null)
    })
    expect(screen.getByRole('button', { name: 'Color: #7E57E3' })).toHaveFocus()
  })

  it('keeps the colours open on the arrows, Enter closes them', async () => {
    renderDs(<Picker onCustom={jest.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Color: none' }))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'No color' })).toHaveFocus()
    })
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Indigo' })).toBeChecked()
    expect(screen.getByRole('radiogroup')).toBeVisible()

    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.queryByRole('radiogroup')).toBe(null)
    })
    expect(screen.getByRole('button', { name: 'Color: #273891' })).toHaveFocus()
  })

  it('offers the free colour last', async () => {
    const onCustom = jest.fn()
    renderDs(<Picker onCustom={onCustom} />)

    await userEvent.click(screen.getByRole('button', { name: 'Color: none' }))
    const radios = await screen.findAllByRole('radio')
    expect(radios.at(-1)).toHaveAccessibleName('Custom color')
    await userEvent.click(screen.getByRole('radio', { name: 'Custom color' }))

    expect(onCustom).toHaveBeenCalled()
  })
})
