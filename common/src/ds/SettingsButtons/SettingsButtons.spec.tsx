import { Pen, Plus } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { SettingsPrimaryButton, SettingsRowButton } from './SettingsButtons'

describe('SettingsButtons', () => {
  it('runs the main and row actions, a row action named by its full name', async () => {
    const onCreate = jest.fn()
    const onEdit = jest.fn()
    renderDs(
      <>
        <SettingsPrimaryButton label="Create" icon={Plus} onClick={onCreate} />
        <SettingsRowButton
          label="Edit"
          name="Edit Alice"
          icon={Pen}
          onClick={onEdit}
        />
      </>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit Alice' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute(
      'type',
      'button'
    )
  })
})
