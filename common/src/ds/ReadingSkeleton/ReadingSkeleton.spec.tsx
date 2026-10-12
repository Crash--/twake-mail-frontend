import { screen } from '@testing-library/react'

import { ReadingInsetContext } from '@/ds/ReadingPane/ReadingPane'
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

  it('leaves the sides to a reading view inset in its frame', () => {
    const { unmount } = renderDs(
      <ReadingSkeleton data-testid="reading-skeleton" />
    )
    const padded = screen.getByTestId('reading-skeleton')
    expect(padded.querySelectorAll('.u-ph-1')).toHaveLength(3)
    unmount()

    renderDs(
      <ReadingInsetContext.Provider value>
        <ReadingSkeleton data-testid="reading-skeleton" />
      </ReadingInsetContext.Provider>
    )
    const inset = screen.getByTestId('reading-skeleton')
    expect(inset.querySelectorAll('.u-ph-1')).toHaveLength(0)
  })
})
