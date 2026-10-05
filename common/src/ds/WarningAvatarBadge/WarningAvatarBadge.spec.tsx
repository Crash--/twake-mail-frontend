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

  it('can be a span, inside a button', () => {
    renderDs(
      <button type="button">
        <WarningAvatarBadge label="Dangerous message" component="span" />
      </button>
    )

    expect(screen.getByRole('img').tagName).toBe('SPAN')
  })
})
