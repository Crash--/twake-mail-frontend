import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsOption,
  SettingsOptionGroup,
  SettingsSwitchRow
} from './SettingsOption'

describe('SettingsOption', () => {
  it('names its switch by its label and describes it by its text', async () => {
    const onChange = jest.fn()
    renderDs(
      <SettingsOptionGroup title="Inbox">
        <SettingsOption
          description="View related emails together"
          toggleLabel="Enable thread"
          isChecked={false}
          onChange={onChange}
        />
      </SettingsOptionGroup>
    )

    const toggle = screen.getByRole('switch', { name: 'Enable thread' })
    expect(toggle).toHaveAccessibleDescription('View related emails together')
    expect(screen.getByRole('region', { name: 'Inbox' })).toContainElement(
      toggle
    )
    await userEvent.click(screen.getByText('Enable thread'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('says what the choice made costs under the switch, as it appears', async () => {
    function Option(): ReactElement {
      const [isChecked, setChecked] = useState(false)
      return (
        <SettingsOption
          description="Show them without asking"
          toggleLabel="Show remote images"
          isChecked={isChecked}
          onChange={setChecked}
          warning={isChecked ? 'You can be tracked' : null}
        />
      )
    }
    renderDs(<Option />)
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    const toggle = screen.getByRole('switch', { name: 'Show remote images' })
    await userEvent.click(toggle)

    // In the live region kept in the page, so that it is announced
    expect(status).toHaveTextContent('You can be tracked')
    expect(toggle).toHaveAccessibleDescription(
      'Show them without asking You can be tracked'
    )

    await userEvent.click(toggle)
    expect(status).toBeEmptyDOMElement()
  })

  it('names the switch of a row by its title', async () => {
    const onChange = jest.fn()
    renderDs(
      <SettingsSwitchRow
        title="Keep a copy in Inbox"
        description="Store forwarded emails"
        isChecked
        onChange={onChange}
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Keep a copy in Inbox' })
    expect(toggle).toHaveAccessibleDescription('Store forwarded emails')
    await userEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
