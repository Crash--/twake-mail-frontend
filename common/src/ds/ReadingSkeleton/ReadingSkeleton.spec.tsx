import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { ReadingSkeleton } from './ReadingSkeleton'

describe('ReadingSkeleton', () => {
  it('is a busy region whose shapes are hidden to screen readers', () => {
    renderDs(<ReadingSkeleton data-testid="reading-skeleton" />)

    const region = screen.getByTestId('reading-skeleton')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelector('[aria-hidden="true"]')).not.toBe(null)
    expect(screen.queryByRole('heading')).toBe(null)
  })
})
