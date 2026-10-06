import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { NavTreeSkeleton } from './NavTreeSkeleton'

describe('NavTreeSkeleton', () => {
  it('draws the rows in a busy region, hidden to screen readers', () => {
    renderDs(<NavTreeSkeleton rowCount={4} data-testid="tree-skeleton" />)

    const region = screen.getByTestId('tree-skeleton')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelectorAll('.MuiSkeleton-root')).toHaveLength(8)
    expect(screen.queryByRole('tree')).toBe(null)
  })
})
