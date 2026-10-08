import { Icon, Reply } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { RowStatusIcon } from './RowStatusIcon'

describe('RowStatusIcon', () => {
  it('is a decorative image: no button, no focus, nothing to announce', () => {
    renderDs(
      <RowStatusIcon label="Replied message" data-testid="status">
        <Icon icon={Reply} size={16} aria-hidden="true" />
      </RowStatusIcon>
    )

    const status = screen.getByTestId('status')
    expect(status).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(status).not.toHaveAttribute('tabindex')
  })
})
