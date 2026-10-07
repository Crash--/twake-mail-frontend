import { screen } from '@testing-library/react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { LoadingAnnouncer } from './LoadingAnnouncer'
import { LoadingListSkeleton } from './LoadingListSkeleton'

describe('LoadingListSkeleton', () => {
  it('says "Loading" in the live region of the page', () => {
    renderWithProviders(
      <LoadingAnnouncer>
        <LoadingListSkeleton count={3} />
      </LoadingAnnouncer>
    )

    expect(screen.getByTestId('loading-announcement')).toHaveTextContent(
      'Loading'
    )
  })

  it('is busy and hides its rows from screen readers', () => {
    renderWithProviders(
      <LoadingListSkeleton count={3} data-testid="section-loading" />
    )

    const region = screen.getByTestId('section-loading')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelector('[aria-hidden="true"]')).not.toBe(null)
  })
})
