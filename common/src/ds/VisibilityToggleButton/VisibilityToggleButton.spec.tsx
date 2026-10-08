import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Eye } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import { VisibilityToggleButton } from './VisibilityToggleButton'

describe('VisibilityToggleButton', () => {
  it('shows its text, is named by its label and reports the clicks', async () => {
    const onClick = jest.fn()
    renderDs(
      <VisibilityToggleButton
        text="Show"
        label="Show Projects"
        icon={Eye}
        onClick={onClick}
      />
    )

    const button = screen.getByRole('button', { name: 'Show Projects' })
    expect(button).toHaveTextContent('Show')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
