import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { WarningAvatarBadge } from './WarningAvatarBadge'

describe('WarningAvatarBadge', () => {
  it('is an image named by its label', () => {
    renderDs(<WarningAvatarBadge label="Dangerous message" data-testid="b" />)

    expect(screen.getByRole('img', { name: 'Dangerous message' })).toBe(
      screen.getByTestId('b')
    )
  })
})
