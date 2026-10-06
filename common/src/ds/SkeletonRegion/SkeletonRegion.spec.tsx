import { Skeleton } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { SkeletonRegion } from './SkeletonRegion'

describe('SkeletonRegion', () => {
  it('is busy and hides its shapes from screen readers', () => {
    renderDs(
      <SkeletonRegion data-testid="region">
        <Skeleton data-testid="shape" />
      </SkeletonRegion>
    )

    expect(screen.getByTestId('region')).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.getByTestId('shape').closest('[aria-hidden="true"]')
    ).not.toBe(null)
    expect(screen.queryByRole('status')).toBe(null)
  })
})
