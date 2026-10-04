import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { StatusDot } from './StatusDot'

describe('StatusDot', () => {
  it('is an image named by its label', () => {
    renderDs(<StatusDot label="Unread" data-testid="dot" />)

    expect(screen.getByRole('img', { name: 'Unread' })).toBe(
      screen.getByTestId('dot')
    )
  })
})
