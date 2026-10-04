import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { RecipientSummary } from './RecipientSummary'

describe('RecipientSummary', () => {
  it('is a button named by its label and its summary, unfolding on click', async () => {
    const onExpand = jest.fn()
    renderDs(
      <RecipientSummary
        summary="Alice, Bob +2"
        label="Show all the recipients:"
        onExpand={onExpand}
      />
    )

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Show all the recipients: Alice, Bob +2'
      })
    )
    expect(onExpand).toHaveBeenCalledTimes(1)
  })
})
