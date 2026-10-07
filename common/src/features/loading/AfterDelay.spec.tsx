import { act, render, screen } from '@testing-library/react'

import { AfterDelay, SKELETON_DELAY_MS } from './AfterDelay'

describe('AfterDelay', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows its children once the delay has passed', () => {
    render(
      <AfterDelay>
        <p>Skeleton</p>
      </AfterDelay>
    )

    expect(screen.queryByText('Skeleton')).toBe(null)

    act(() => {
      jest.advanceTimersByTime(SKELETON_DELAY_MS)
    })

    expect(screen.getByText('Skeleton')).toBeInTheDocument()
  })

  it('never shows them when it is gone before the delay', () => {
    const { unmount } = render(
      <AfterDelay>
        <p>Skeleton</p>
      </AfterDelay>
    )

    unmount()
    act(() => {
      jest.advanceTimersByTime(SKELETON_DELAY_MS * 2)
    })

    expect(screen.queryByText('Skeleton')).toBe(null)
  })

  it('shows them from the first render without a delay', () => {
    render(
      <AfterDelay delayMs={0}>
        <p>Skeleton</p>
      </AfterDelay>
    )

    expect(screen.getByText('Skeleton')).toBeInTheDocument()
  })
})
