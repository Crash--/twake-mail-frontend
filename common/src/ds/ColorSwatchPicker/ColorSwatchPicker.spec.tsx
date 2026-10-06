import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ColorSwatchPicker, type CustomColor } from './ColorSwatchPicker'

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

  describe('custom colour', () => {
    const CUSTOM: CustomColor = {
      label: 'Custom color',
      valueLabel: value => `Custom color ${value}`,
      hexLabel: 'Hexadecimal',
      hint: 'Format #RRGGBB',
      invalidMessage: 'Not a color',
      pickerLabel: 'Open the picker'
    }

    function setup(
      value: string | null,
      custom: Partial<CustomColor> = {}
    ): jest.Mock {
      const onChange = jest.fn()
      renderDs(
        <ColorSwatchPicker
          legend="Choose a color"
          swatches={SWATCHES}
          value={value}
          onChange={onChange}
          custom={{ ...CUSTOM, ...custom }}
        />
      )
      return onChange
    }

    it('opens the hexadecimal field from the swatch, keeping the current colour', async () => {
      const onChange = setup('#273891')

      expect(screen.queryByRole('textbox')).toBe(null)
      await userEvent.click(screen.getByRole('radio', { name: 'Custom color' }))

      expect(screen.getByRole('textbox', { name: 'Hexadecimal' })).toHaveValue(
        '#273891'
      )
      expect(onChange).toHaveBeenLastCalledWith('#273891')
      expect(
        screen.getByRole('radio', { name: 'Custom color #273891' })
      ).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Indigo' })).not.toBeChecked()
    })

    it('checks the custom swatch for a colour out of the swatches', () => {
      setup('#aabbcc')

      expect(
        screen.getByRole('radio', { name: 'Custom color #AABBCC' })
      ).toBeChecked()
      expect(screen.getByRole('textbox', { name: 'Hexadecimal' })).toHaveValue(
        '#AABBCC'
      )
    })

    it('sends the colour typed once it is valid, in capitals, and says the field is wrong otherwise', async () => {
      const onValidityChange = jest.fn()
      const onChange = setup('#AABBCC', { onValidityChange })
      const field = screen.getByRole('textbox', { name: 'Hexadecimal' })

      await userEvent.clear(field)
      expect(onValidityChange).toHaveBeenLastCalledWith(false)
      await userEvent.type(field, 'c0ffee')
      expect(onValidityChange).toHaveBeenLastCalledWith(true)
      expect(onChange).toHaveBeenLastCalledWith('#C0FFEE')

      await userEvent.clear(field)
      await userEvent.type(field, '#12')
      await userEvent.tab()
      expect(field).toBeInvalid()
      expect(field).toHaveAccessibleDescription('Not a color')
      expect(onChange).toHaveBeenLastCalledWith('#C0FFEE')
    })

    it('shows the error of an untouched field when asked to', async () => {
      setup('#AABBCC', { showError: true })
      const field = screen.getByRole('textbox', { name: 'Hexadecimal' })
      await userEvent.clear(field)

      expect(field).toBeInvalid()
    })

    it('takes the colour of the native input', () => {
      const onChange = setup('#AABBCC')

      fireEvent.change(screen.getByLabelText('Open the picker'), {
        target: { value: '#112233' }
      })

      expect(onChange).toHaveBeenLastCalledWith('#112233')
      expect(screen.getByRole('textbox', { name: 'Hexadecimal' })).toHaveValue(
        '#112233'
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        'Custom color #112233'
      )
    })

    it('goes back to a swatch', async () => {
      const onChange = setup('#AABBCC')

      await userEvent.click(screen.getByRole('radio', { name: 'Violet' }))

      expect(onChange).toHaveBeenLastCalledWith('#7E57E3')
      expect(screen.queryByRole('textbox')).toBe(null)
    })
  })
})
