import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { RowCheckbox } from './RowCheckbox'

describe('RowCheckbox', () => {
  it('is a checkbox named by its label, reporting the clicks', async () => {
    const onClick = jest.fn()
    renderDs(
      <RowCheckbox checked={false} onClick={onClick} label="Select Hi" />
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Select Hi' })
    expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
