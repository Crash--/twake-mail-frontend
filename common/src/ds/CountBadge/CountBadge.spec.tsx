import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { CountBadge } from './CountBadge'

describe('CountBadge', () => {
  it('shows the count', () => {
    renderDs(<CountBadge count={42} data-testid="badge" />)

    expect(screen.getByTestId('badge')).toHaveTextContent('42')
  })

  it('caps the count at 999+', () => {
    renderDs(<CountBadge count={999} data-testid="a" />)
    renderDs(<CountBadge count={1000} data-testid="b" />)

    expect(screen.getByTestId('a')).toHaveTextContent('999')
    expect(screen.getByTestId('a')).not.toHaveTextContent('999+')
    expect(screen.getByTestId('b')).toHaveTextContent('999+')
  })

  it('can be hidden from assistive technologies', () => {
    renderDs(<CountBadge count={3} aria-hidden data-testid="badge" />)

    expect(screen.getByTestId('badge')).toHaveAttribute('aria-hidden', 'true')
  })
})
