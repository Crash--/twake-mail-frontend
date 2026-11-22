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
    expect(view.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBe(
      null
    )
    expect(screen.queryByRole('img')).toBe(null)
    expect(screen.queryByRole('heading')).toBe(null)
  })

  it('has no hint without a text', () => {
    renderDs(<EmptyListView title="Nothing here" data-testid="empty" />)

    expect(screen.getByTestId('empty').querySelectorAll('p')).toHaveLength(1)
  })
})
