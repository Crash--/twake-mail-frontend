import { Filter, Plus } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { SettingsEmptyState } from './SettingsEmptyState'

describe('SettingsEmptyState', () => {
  it('says the list is empty and starts it', async () => {
    const onClick = jest.fn()
    renderDs(
      <SettingsEmptyState
        icon={Filter}
        title="No Rules Configured"
        text="Start by creating your first rule."
        action={{ label: 'Create My First Rule', icon: Plus, onClick }}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'No Rules Configured' })
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Create My First Rule' })
    )
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
