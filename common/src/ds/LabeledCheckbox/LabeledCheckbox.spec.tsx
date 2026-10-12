import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { LabeledCheckbox } from './LabeledCheckbox'

describe('LabeledCheckbox', () => {
  it('is a checkbox named by its label, reporting its new state', async () => {
    const onChange = jest.fn()
    renderDs(
      <LabeledCheckbox label="Unread" checked={false} onChange={onChange} />
    )

    await userEvent.click(screen.getByRole('checkbox', { name: 'Unread' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })
})
