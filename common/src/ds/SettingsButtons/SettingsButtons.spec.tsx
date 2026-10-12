import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Pen, Plus } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsPrimaryButton,
  SettingsRowButton,
  SettingsTextButton
} from './SettingsButtons'

describe('SettingsButtons', () => {
  it('runs the main, secondary and row actions, a row action named by its full name', async () => {
    const onCreate = jest.fn()
    const onCancel = jest.fn()
    const onEdit = jest.fn()
    renderDs(
      <>
        <SettingsPrimaryButton label="Create" icon={Plus} onClick={onCreate} />
        <SettingsTextButton label="Cancel" onClick={onCancel} />
        <SettingsRowButton
          label="Edit"
          name="Edit Alice"
          icon={Pen}
          onClick={onEdit}
        />
      </>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit Alice' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute(
      'type',
      'button'
    )
  })
})
