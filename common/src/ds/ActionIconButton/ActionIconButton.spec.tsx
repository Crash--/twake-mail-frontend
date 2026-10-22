import { Icon, Cross } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { ActionIconButton } from './ActionIconButton'

describe('ActionIconButton', () => {
  it('is a small icon button named by its label', () => {
    renderDs(
      <ActionIconButton label="Close">
        <Icon icon={Cross} size={16} aria-hidden="true" />
      </ActionIconButton>
    )

    const button = screen.getByRole('button', { name: 'Close' })
    expect(button).toHaveClass('MuiIconButton-sizeSmall')
    expect(button.querySelector('svg')).toBeInTheDocument()
  })
})
