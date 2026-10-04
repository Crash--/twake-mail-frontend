import {
  VirtuosoMockContext,
  type VirtualizedTableColumn,
  type VirtualizedTableRow
} from '@linagora/twake-mui'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import type { VirtualizedListTableProps } from './VirtualizedListTable'

import { renderDs } from '@/ds/testing/renderDs'

import {
  ROW_FOCUS_ATTRIBUTE,
  VirtualizedListTable
} from './VirtualizedListTable'

const COLUMNS: VirtualizedTableColumn[] = [
  { id: 'name', label: 'Name', sortable: false },
  { id: 'size', label: 'Size', width: 80, sortable: false }
]

const ROWS: VirtualizedTableRow[] = [
  { id: 'a', name: 'Alpha', size: '1 KB' },
  { id: 'b', name: 'Beta', size: '2 KB' },
  { id: 'c', name: 'Gamma', size: '3 KB' }
]

function NameCell({
  row,
  column
}: {
  row?: VirtualizedTableRow
  column?: VirtualizedTableColumn
}): ReactElement | null {
  if (!row || !column) return null
  const value = typeof row[column.id] === 'string' ? String(row[column.id]) : ''
  if (column.id !== 'name') return <>{value}</>
  return (
    <button type="button" {...{ [ROW_FOCUS_ATTRIBUTE]: true }}>
      {value}
    </button>
  )
}

const COMPACT_COLUMNS: VirtualizedTableColumn[] = [
  { id: 'name', label: 'File', sortable: false }
]

function renderTable(
  onEndReached = jest.fn(),
  props: Partial<VirtualizedListTableProps> = {}
): ReturnType<typeof renderDs> {
  return renderDs(
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 10_000, itemHeight: 40 }}
    >
      <VirtualizedListTable
        label="Files"
        rows={ROWS}
        rowCount={42}
        columns={COLUMNS}
        computeItemKey={(_index, row) => String(row.id)}
        getRowProps={row => ({
          'data-testid': 'file-row',
          'data-file-id': String(row.id)
        })}
        endReached={onEndReached}
        componentsProps={{ rowContent: { children: <NameCell /> } }}
        data-testid="files"
        {...props}
      />
    </VirtuosoMockContext.Provider>
  )
}

describe('VirtualizedListTable', () => {
  it('is a named table whose column headers name the cells', () => {
    renderTable()

    const table = screen.getByRole('table', { name: 'Files' })
    expect(table).toHaveAttribute('aria-rowcount', '43')
    expect(
      screen.getAllByRole('columnheader').map(header => header.textContent)
    ).toEqual(['Name', 'Size'])
    expect(screen.getByTestId('files')).toContainElement(table)
  })

  it('puts the attributes of each row on its table row', () => {
    renderTable()

    const rows = screen.getAllByTestId('file-row')
    expect(rows.map(row => row.getAttribute('data-file-id'))).toEqual([
      'a',
      'b',
      'c'
    ])
    expect(rows[0]).toHaveAttribute('aria-rowindex', '2')
    const [, beta] = rows
    if (!beta) throw new Error('Three rows expected')
    expect(within(beta).getByRole('cell', { name: '2 KB' })).toBeVisible()
  })

  it('moves the focus between rows with the arrow keys', async () => {
    renderTable()
    screen.getByRole('button', { name: 'Alpha' }).focus()

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Gamma' })).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Gamma' })).toHaveFocus()
  })

  it('reports the end of the list', async () => {
    const onEndReached = jest.fn()
    renderTable(onEndReached)

    await waitFor(() => {
      expect(onEndReached).toHaveBeenCalledWith(2)
    })
  })

  it('switches to the compact columns when it is narrow', async () => {
    // Reports widths for the scroller only: virtuoso observes its rows too
    let reportWidth: (width: number) => void = () => undefined
    class ResizeObserverMock implements ResizeObserver {
      readonly #callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.#callback = callback
      }
      observe(target: Element): void {
        if (!target.classList.contains('MuiTableContainer-root')) return
        reportWidth = width => {
          this.#callback(
            [{ target, contentRect: { width } } as ResizeObserverEntry],
            this
          )
        }
        reportWidth(1024)
      }
      unobserve(): void {
        // nothing to stop
      }
      disconnect(): void {
        // nothing to stop
      }
    }
    const stub = globalThis.ResizeObserver
    globalThis.ResizeObserver = ResizeObserverMock
    renderTable(jest.fn(), { compactColumns: COMPACT_COLUMNS })
    globalThis.ResizeObserver = stub
    const headers = (): (string | null)[] =>
      screen.getAllByRole('columnheader').map(header => header.textContent)
    expect(headers()).toEqual(['Name', 'Size'])

    act(() => {
      reportWidth(390)
    })

    await waitFor(() => {
      expect(headers()).toEqual(['File'])
    })
    act(() => {
      reportWidth(800)
    })
    await waitFor(() => {
      expect(headers()).toEqual(['Name', 'Size'])
    })
  })

  it('uses the compact columns when asked to, whatever the width', () => {
    renderTable(jest.fn(), { compactColumns: COMPACT_COLUMNS, compact: true })

    expect(
      screen.getAllByRole('columnheader').map(header => header.textContent)
    ).toEqual(['File'])
  })

  it('leaves room after the last row, hidden to screen readers', () => {
    const { container } = renderTable(jest.fn(), { bottomInset: 88 })

    const spacer = container.querySelector('tfoot')
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1)
  })
})
