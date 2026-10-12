import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { BackButton } from './BackButton'

describe('BackButton', () => {
  it('is a button named by its label, showing its text', async () => {
    const onClick = jest.fn()
    renderDs(
      <BackButton label="Back to Inbox" onClick={onClick}>
        Inbox
      </BackButton>
    )

    const button = screen.getByRole('button', { name: 'Back to Inbox' })
    expect(button).toHaveTextContent('Inbox')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
