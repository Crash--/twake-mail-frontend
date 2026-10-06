import { Cross, Icon } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { ActionIconButton } from './ActionIconButton'

describe('ActionIconButton', () => {
  it('is a 40 px button named by its label, with a 24 px icon', () => {
    renderDs(
      <ActionIconButton label="Close">
        <Icon icon={Cross} size={16} aria-hidden="true" />
      </ActionIconButton>
    )

    const button = screen.getByRole('button', { name: 'Close' })
    expect(button).toHaveStyle({ width: '40px', height: '40px' })
    expect(button.querySelector('svg')).toBeInTheDocument()
  })
})
