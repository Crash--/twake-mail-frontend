import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { SettingsOption, SettingsSwitchRow } from './SettingsOption'

describe('SettingsOption', () => {
  it('names its switch by its label and describes it by its title and text', async () => {
    const onChange = jest.fn()
    renderDs(
      <SettingsOption
        title="Thread"
        description="View related emails together"
        toggleLabel="Enable thread"
        isChecked={false}
        onChange={onChange}
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable thread' })
    expect(toggle).toHaveAccessibleDescription(
      'Thread View related emails together'
    )
    expect(screen.getByRole('heading', { name: 'Thread' })).toBeVisible()
    await userEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
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
