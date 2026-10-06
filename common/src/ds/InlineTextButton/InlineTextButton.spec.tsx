import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { InlineTextButton } from './InlineTextButton'

describe('InlineTextButton', () => {
  it('is a button, underlined when asked to', async () => {
    const onClick = jest.fn()
    renderDs(
      <InlineTextButton isUnderlined onClick={onClick}>
        Unsubscribe
      </InlineTextButton>
    )
    const button = screen.getByRole('button', { name: 'Unsubscribe' })
    expect(button).toHaveStyle({ textDecoration: 'underline' })

    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
