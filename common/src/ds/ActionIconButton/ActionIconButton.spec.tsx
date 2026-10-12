import { Icon } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { ActionIconButton } from './ActionIconButton'

describe('ActionIconButton', () => {
  it('is a 34 px button named by its label, as in tmail-flutter', () => {
    renderDs(
      <ActionIconButton label="Close">
        <Icon icon={Cross} size={16} aria-hidden="true" />
      </ActionIconButton>
    )

    const button = screen.getByRole('button', { name: 'Close' })
    expect(button).toHaveStyle({ width: '34px', height: '34px' })
    expect(button.querySelector('svg')).toBeInTheDocument()
  })
})
