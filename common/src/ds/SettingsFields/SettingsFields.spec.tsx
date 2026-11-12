import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsFormRow,
  SettingsLabelPill,
  SettingsMenuSelect,
  SettingsSelect,
  SettingsTextField
} from './SettingsFields'

function Field(): ReactElement {
  const [value, setValue] = useState('')
  return (
    <SettingsFormRow label="Subject:" htmlFor="subject">
      <SettingsTextField
        id="subject"
        label="Subject"
        value={value}
        onChange={event => {
          setValue(event.target.value)
        }}
      />
    </SettingsFormRow>
  )
}

function DateField(): ReactElement {
  return (
    <SettingsTextField
      type="date"
      label="Start date"
      pickerLabel="Select date"
      value="2026-11-12"
      onChange={() => undefined}
      inputTestId="start-date"
    />
  )
}

const originalCss = Object.getOwnPropertyDescriptor(globalThis, 'CSS')

/** jsdom has no `CSS.supports`: Gecko, whose picker button stays, or not */
function mockPickerHiding(canHide: boolean): void {
  Object.defineProperty(globalThis, 'CSS', {
    value: { supports: () => !canHide },
    configurable: true
  })
}

describe('SettingsFields', () => {
  beforeEach(() => {
    mockPickerHiding(true)
  })

  afterEach(() => {
    if (originalCss === undefined) Reflect.deleteProperty(globalThis, 'CSS')
    else Object.defineProperty(globalThis, 'CSS', originalCss)
  })

  it('keeps the button of the browser where it cannot be hidden (Firefox)', () => {
    mockPickerHiding(false)
    renderDs(<DateField />)

    expect(screen.queryByRole('button', { name: 'Select date' })).toBe(null)
  })

  it('opens the picker of a date field from a named button', async () => {
    // jsdom has no showPicker
    const showPicker = jest.fn()
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      value: showPicker,
      configurable: true
    })
    try {
      renderDs(<DateField />)

      await userEvent.click(screen.getByRole('button', { name: 'Select date' }))

      expect(showPicker).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('start-date')).toHaveFocus()
    } finally {
      Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
    }
  })

  it('leaves the focus in the date field when the browser has no picker to open', async () => {
    renderDs(<DateField />)

    await userEvent.click(screen.getByRole('button', { name: 'Select date' }))

    expect(screen.getByTestId('start-date')).toHaveFocus()
  })

  it('labels a field of a form row', async () => {
    renderDs(<Field />)

    const field = screen.getByRole('textbox', { name: 'Subject' })
    await userEvent.type(field, 'Away')
    expect(field).toHaveValue('Away')
    expect(screen.getByLabelText('Subject:')).toBe(field)
  })

  it('labels a select by the text above it', () => {
    renderDs(
      <SettingsSelect label="Language" value="en" onChange={jest.fn()}>
        <option value="en">English</option>
      </SettingsSelect>
    )

    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en')
  })

  it('picks from a menu: the field shows the short name, the menu checks the value', async () => {
    const onChange = jest.fn()
    renderDs(
      <SettingsMenuSelect
        label="Language"
        value="en"
        options={[
          { value: 'en', label: 'English - English', shortLabel: 'English' },
          { value: 'fr', label: 'French - Français', shortLabel: 'French' }
        ]}
        onChange={onChange}
      />
    )

    const field = screen.getByRole('combobox', { name: /^Language/ })
    expect(field).toHaveTextContent('English')
    await userEvent.click(field)
    expect(
      screen.getByRole('option', { name: 'English - English' })
    ).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(
      screen.getByRole('option', { name: 'French - Français' })
    )
    expect(onChange).toHaveBeenCalledWith('fr')
  })

  it('shows a label with its value', () => {
    renderDs(
      <SettingsLabelPill
        component="h2"
        label="Forward to"
        pill="2 recipients"
      />
    )

    expect(screen.getByRole('heading', { name: 'Forward to' })).toBeVisible()
    expect(screen.getByText('2 recipients')).toBeVisible()
  })
})
