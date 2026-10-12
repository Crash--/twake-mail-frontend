import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsCount,
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

describe('SettingsFields', () => {
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
      <>
        <SettingsLabelPill
          component="h2"
          label="Forward to"
          pill="2 recipients"
        />
        <SettingsCount label="Name of Rules" count={3} />
      </>
    )

    expect(screen.getByRole('heading', { name: 'Forward to' })).toBeVisible()
    expect(screen.getByText('2 recipients')).toBeVisible()
    expect(screen.getByText('Name of Rules')).toHaveTextContent(
      'Name of Rules 3'
    )
  })
})
