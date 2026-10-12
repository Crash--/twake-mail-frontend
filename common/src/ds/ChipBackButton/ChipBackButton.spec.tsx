import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ChipBackButton } from './ChipBackButton'

describe('ChipBackButton', () => {
  it('shows its text and is named by its label', async () => {
    const onClick = jest.fn()
    renderDs(
      <ChipBackButton label="Back to mail" onClick={onClick}>
        Back
      </ChipBackButton>
    )

    const button = screen.getByRole('button', { name: 'Back to mail' })
    expect(button).toHaveTextContent('Back')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
