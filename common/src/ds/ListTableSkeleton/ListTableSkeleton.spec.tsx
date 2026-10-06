import { Skeleton } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { ListTableSkeleton } from './ListTableSkeleton'

const ROW_LAYOUT = { paddingX: 8, paddingTop: 6, paddingBottom: 5, gap: 8 }

function renderSkeleton(compact: boolean): void {
  renderDs(
    <ListTableSkeleton
      columns={[
        { id: 'a', width: 40, cell: <Skeleton data-testid="wide-cell" /> },
        { id: 'b', cell: <Skeleton data-testid="wide-cell" /> }
      ]}
      compactColumns={[
        { id: 'c', cell: <Skeleton data-testid="compact-cell" /> }
      ]}
      compact={compact}
      rowCount={3}
      rowLayout={ROW_LAYOUT}
      cellHeight={32}
      data-testid="skeleton"
    />
  )
}

describe('ListTableSkeleton', () => {
  it('draws a cell per column and row, in a busy region', () => {
    renderSkeleton(false)

    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByTestId('wide-cell')).toHaveLength(6)
    expect(screen.queryByTestId('compact-cell')).toBe(null)
  })

  it('uses the compact columns when asked', () => {
    renderSkeleton(true)

    expect(screen.getAllByTestId('compact-cell')).toHaveLength(3)
    expect(screen.queryByTestId('wide-cell')).toBe(null)
  })

  it('is hidden to screen readers', () => {
    renderSkeleton(false)

    expect(screen.queryByRole('table')).toBe(null)
  })
})
