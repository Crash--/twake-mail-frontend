import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { EmptyListView } from './EmptyListView'

describe('EmptyListView', () => {
  it('shows the title and the hint below a decorative drawing', () => {
    renderDs(
      <EmptyListView
        title="Nothing here"
        text="Start to compose emails."
        data-testid="empty"
      />
    )

    const view = screen.getByTestId('empty')
    expect(view).toHaveTextContent('Nothing hereStart to compose emails.')
    const drawing = view.querySelector('svg')
    expect(drawing).toHaveAttribute('aria-hidden', 'true')
    expect(drawing).toHaveAttribute('focusable', 'false')
    expect(screen.queryByRole('img')).toBe(null)
    expect(screen.queryByRole('heading')).toBe(null)
  })

  it('draws the envelope white on the tile of twake-mui, in every scheme', () => {
    renderDs(<EmptyListView title="Nothing here" data-testid="empty" />)

    const tile = screen.getByTestId('empty').querySelector('.Empty-iconTile')
    if (tile === null) throw new Error('No tile')
    // common.white, not background.paper, which is dark in dark mode
    expect(getComputedStyle(tile).color).toBe(
      'var(--twake-palette-common-white)'
    )
  })

  it('has no hint without a text', () => {
    renderDs(<EmptyListView title="Nothing here" data-testid="empty" />)

    expect(screen.getByTestId('empty').querySelectorAll('p')).toHaveLength(1)
  })
})
