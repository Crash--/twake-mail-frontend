// Upstream to twake-ui: yes, as options of `VirtualizedTable` rather than a
// second component. This wrapper only exists because `VirtualizedTable`
// 9.16 cannot: add attributes to a row (`getRowProps`), hide its header
// visually while keeping it for screen readers (`hideHeader`), name the
// table, give it a density, nor be extended without replacing its whole
// `components` set (`virtuosoComponents` is not exported). See
// docs/twake-mui-gaps.md, "Virtualized list table", for the PR to make.
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
  VirtualizedTable,
  type VirtualizedTableColumn,
  type VirtualizedTableProps,
  type VirtualizedTableRow
} from '@linagora/twake-mui'
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useMemo,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement
} from 'react'

/** `data-*` and `aria-*` attributes put on a row */
export type RowAttributes = Partial<
  Record<`data-${string}` | `aria-${string}`, string | number | boolean>
>

/** The rows in view, as `rangeChanged` reports them */
export type ListTableRange = Parameters<
  NonNullable<VirtualizedTableProps['rangeChanged']>
>[0]

type TableComponents = NonNullable<VirtualizedTableProps['components']>
type ScrollerProps = ComponentProps<NonNullable<TableComponents['Scroller']>>
type TableProps = ComponentProps<NonNullable<TableComponents['Table']>>
type TableHeadProps = ComponentProps<NonNullable<TableComponents['TableHead']>>
type TableBodyProps = ComponentProps<NonNullable<TableComponents['TableBody']>>
type TableRowProps = ComponentProps<NonNullable<TableComponents['TableRow']>>

interface ListTableSettings {
  label: string
  rowCount: number | null
  columns: readonly VirtualizedTableColumn[]
  getRowProps: ((row: VirtualizedTableRow) => RowAttributes) | null
}

const ListTableContext = createContext<ListTableSettings>({
  label: '',
  rowCount: null,
  columns: [],
  getRowProps: null
})

/** Marks the focusable element of a row that the arrow keys move between */
export const ROW_FOCUS_ATTRIBUTE = 'data-row-focus'

const ROW_SX = {
  // Containing block of the `RowLink` overlay, under the row controls
  position: 'relative',
  '& .MuiButtonBase-root': { position: 'relative', zIndex: 1 },
  // The theme greys body cells with text.secondary, 3.6:1 on white: below
  // the 4.5:1 of RGAA 3.2 (docs/twake-mui-gaps.md)
  '& .MuiTableCell-body': { color: 'text.primary' }
} as const

/**
 * ArrowDown / ArrowUp move the focus to the same control of the next or
 * previous row; virtuoso renders rows beyond the viewport, and focusing one
 * scrolls it into view.
 */
function handleArrowKeys(event: KeyboardEvent<HTMLTableElement>): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  if (!(event.target instanceof HTMLElement)) return
  if (!event.target.hasAttribute(ROW_FOCUS_ATTRIBUTE)) return
  const row = event.target.closest('tr')
  const sibling =
    event.key === 'ArrowDown'
      ? row?.nextElementSibling
      : row?.previousElementSibling
  const target = sibling?.querySelector(`[${ROW_FOCUS_ATTRIBUTE}]`)
  if (target instanceof HTMLElement) {
    event.preventDefault()
    target.focus()
  }
}

const Scroller = forwardRef<HTMLDivElement, ScrollerProps>(function Scroller(
  { context: _context, ...props },
  ref
) {
  return (
    <TableContainer
      {...props}
      ref={ref}
      component={Paper}
      elevation={0}
      square
    />
  )
})

/**
 * Fixed layout, so that long cells end with an ellipsis instead of widening
 * the table; the widths come from a `colgroup`, since the first row of a
 * virtuoso table is a one-cell spacer.
 */
function ListTable({
  context: _context,
  children,
  ...props
}: TableProps): ReactElement {
  const { label, rowCount, columns } = useContext(ListTableContext)
  return (
    <Table
      {...props}
      aria-label={label}
      // + 1: the header row
      aria-rowcount={rowCount === null ? -1 : rowCount + 1}
      onKeyDown={handleArrowKeys}
      sx={{ tableLayout: 'fixed' }}
    >
      <colgroup>
        {columns.map(column => (
          <Box component="col" key={column.id} sx={{ width: column.width }} />
        ))}
      </colgroup>
      {children}
    </Table>
  )
}

/** Hidden to the eye, not to screen readers: the column headers name the cells */
const HiddenTableHead = forwardRef<HTMLTableSectionElement, TableHeadProps>(
  function HiddenTableHead({ context: _context, ...props }, ref) {
    return <TableHead {...props} ref={ref} className="u-visuallyhidden" />
  }
)

const ListTableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  function ListTableBody({ context: _context, ...props }, ref) {
    return <TableBody {...props} ref={ref} />
  }
)

function ListTableRow({
  item,
  context,
  ...props
}: TableRowProps): ReactElement {
  const { getRowProps } = useContext(ListTableContext)
  return (
    <TableRow
      {...props}
      {...getRowProps?.(item)}
      // 1 is the header row
      aria-rowindex={props['data-index'] + 2}
      selected={context.isSelectedItem(item)}
      hover
      sx={ROW_SX}
    />
  )
}

const COMPONENTS: TableComponents = {
  Scroller,
  Table: ListTable,
  TableHead: HiddenTableHead,
  TableBody: ListTableBody,
  TableRow: ListTableRow
}

export interface VirtualizedListTableProps extends Omit<
  VirtualizedTableProps,
  'components'
> {
  /** Accessible name of the table, e.g. "Messages" */
  label: string
  /** Number of rows of the whole list, loaded or not; null when unknown */
  rowCount?: number | null
  /** Attributes of the `tr` of a row: `data-*` ids and states, `aria-*` */
  getRowProps?: (row: VirtualizedTableRow) => RowAttributes
  /**
   * Row to show and focus when the table mounts, e.g. the email the user
   * comes back from: its `RowLink` gets the focus, its position the scroll
   */
  focusedRowIndex?: number | null
  'data-testid'?: string
}

/** Frames to wait for the row to focus to be rendered */
const FOCUS_FRAMES = 30

/** Focuses the `ROW_FOCUS_ATTRIBUTE` element of a row once it is rendered */
function useFocusRowOnMount(tableId: string, index: number | null): void {
  useEffect(() => {
    if (index === null) return
    let frame = 0
    let handle = 0
    const tryFocus = (): void => {
      const target = document
        .getElementById(tableId)
        ?.querySelector(`tr[data-index="${index}"] [${ROW_FOCUS_ATTRIBUTE}]`)
      if (target instanceof HTMLElement) {
        target.focus()
      } else if (frame < FOCUS_FRAMES) {
        frame += 1
        handle = requestAnimationFrame(tryFocus)
      }
    }
    tryFocus()
    return () => {
      cancelAnimationFrame(handle)
    }
    // On mount only: later changes of the index are the list moving
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/**
 * A `VirtualizedTable` shaped as a list: fixed layout, readable cells,
 * column headers for screen readers only, attributes on the rows, and the
 * arrow keys moving between rows, focus restored on a row when coming back
 * to the list. Rows are not clickable by themselves: put
 * a `RowLink` in a cell to make the whole row a real link.
 */
export function VirtualizedListTable({
  label,
  rowCount = null,
  getRowProps,
  columns,
  focusedRowIndex = null,
  ...props
}: VirtualizedListTableProps): ReactElement {
  const tableId = useId()
  useFocusRowOnMount(tableId, focusedRowIndex)
  const settings = useMemo<ListTableSettings>(
    () => ({ label, rowCount, columns, getRowProps: getRowProps ?? null }),
    [label, rowCount, columns, getRowProps]
  )
  return (
    <ListTableContext.Provider value={settings}>
      <VirtualizedTable
        {...props}
        id={tableId}
        // Not even undefined otherwise: virtuoso would render no row. The
        // first rows are in view anyway
        {...(focusedRowIndex === null || focusedRowIndex === 0
          ? {}
          : {
              initialTopMostItemIndex: {
                index: focusedRowIndex,
                align: 'center' as const
              }
            })}
        columns={columns}
        components={COMPONENTS}
      />
    </ListTableContext.Provider>
  )
}
