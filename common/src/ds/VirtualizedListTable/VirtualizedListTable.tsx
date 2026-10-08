// Upstream to twake-ui: yes, as options of `VirtualizedTable` rather than a
// second component. This wrapper only exists because `VirtualizedTable`
// 9.16 cannot: add attributes to a row (`getRowProps`), hide its header
// visually while keeping it for screen readers (`hideHeader`), name the
// table, give it a density, switch to fewer columns when it is narrow, nor
// be extended without replacing its whole `components` set
// (`virtuosoComponents` is not exported). See docs/twake-mui-gaps.md,
// "VirtualizedTable", for the PR to make.
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
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
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
type TableFootProps = ComponentProps<NonNullable<TableComponents['TableFoot']>>

/** Where a row menu opens: at the pointer, or under the row (keyboard) */
export type RowMenuAnchor =
  { position: { left: number; top: number } } | { element: HTMLElement }

/**
 * How the cells of a row are laid out, in px: the row pads its content
 * (`paddingX` on the sides, `paddingTop` and `paddingBottom` above and
 * below) and the cells are `gap` apart. The column widths include these
 * paddings.
 */
export interface RowLayout {
  paddingX: number
  paddingTop: number
  paddingBottom: number
  gap: number
  /** The divider under the row starts after its first cell */
  insetDivider?: boolean
  /**
   * The divider under the row keeps this margin on both sides instead
   * (tmail-flutter's compact rows), in px
   */
  dividerMarginX?: number
}

/** The divider between the rows, as tmail-flutter's */
const ROW_DIVIDER_COLOR = '#E7E8EC'
/** The background of a hovered row, as tmail-flutter's */
const ROW_HOVER_COLOR = '#F4F4F5'
/** The background of a selected row, as tmail-flutter's (`blue100`) */
const ROW_SELECTED_COLOR = '#DFEEFF'

interface ListTableSettings {
  label: string
  rowLayout: RowLayout | null
  rowCount: number | null
  columns: readonly VirtualizedTableColumn[]
  getRowProps: ((row: VirtualizedTableRow) => RowAttributes) | null
  onRowMenu: ((row: VirtualizedTableRow, anchor: RowMenuAnchor) => void) | null
  onRowDragStart:
    ((row: VirtualizedTableRow, event: DragEvent<HTMLElement>) => void) | null
  /** Reports the width of the scroller, null when nobody listens */
  onWidthChange: ((width: number) => void) | null
}

const ListTableContext = createContext<ListTableSettings>({
  label: '',
  rowLayout: null,
  rowCount: null,
  columns: [],
  getRowProps: null,
  onRowMenu: null,
  onRowDragStart: null,
  onWidthChange: null
})

/** Width below which `compactColumns` replace `columns`, in pixels */
export const COMPACT_BELOW = 600

/** Marks the focusable element of a row that the arrow keys move between */
export const ROW_FOCUS_ATTRIBUTE = 'data-row-focus'

const ROW_SX = {
  // Containing block of the `RowLink` overlay, under the row controls
  position: 'relative',
  '& .MuiButtonBase-root': { position: 'relative', zIndex: 1 },
  // The theme greys body cells with text.secondary, 3.6:1 on white: below
  // the 4.5:1 of RGAA 3.2 (docs/twake-mui-gaps.md)
  '& .MuiTableCell-body': { color: 'text.primary' },
  // The mock selects a row with the primary colour at 8 %; the theme's
  // `selectedOpacity` (18 %) is heavier (docs/twake-mui-gaps.md)
  '&.Mui-selected, &.Mui-selected:hover': {
    backgroundColor:
      'color-mix(in srgb, var(--mui-palette-primary-main) 8%, transparent)'
  }
} as const

export function makeRowLayoutSx({
  paddingX,
  paddingTop,
  paddingBottom,
  gap,
  insetDivider = false,
  dividerMarginX
}: RowLayout): Record<string, Record<string, string> | string> {
  return {
    // A line drawn by the row, as wide as the row less the margins: the
    // borders of the cells always span it all
    ...(dividerMarginX === undefined
      ? {}
      : {
          backgroundImage: `linear-gradient(${ROW_DIVIDER_COLOR}, ${ROW_DIVIDER_COLOR})`,
          backgroundSize: `calc(100% - ${2 * dividerMarginX}px) 1px`,
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
          '& .MuiTableCell-root.MuiTableCell-root': { borderBottom: 'none' }
        }),
    '& .MuiTableCell-root': {
      boxSizing: 'border-box',
      padding: `${paddingTop}px 0 ${paddingBottom}px ${gap}px`,
      borderBottomColor: ROW_DIVIDER_COLOR
    },
    '& .MuiTableCell-root:first-of-type': {
      paddingLeft: `${paddingX}px`,
      ...(insetDivider ? { borderBottomColor: 'transparent' } : {})
    },
    // tmail-flutter's selected row: light blue, rounded by 8 px
    '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: 'transparent' },
    '&.Mui-selected .MuiTableCell-root, &.Mui-selected:hover .MuiTableCell-root':
      { backgroundColor: ROW_SELECTED_COLOR },
    '&.Mui-selected .MuiTableCell-root:first-of-type': {
      borderRadius: '8px 0 0 8px'
    },
    '&.Mui-selected .MuiTableCell-root:last-of-type': {
      borderRadius: '0 8px 8px 0'
    },
    // tmail-flutter's hovered row: light grey, rounded by 14 px
    '&.MuiTableRow-hover:hover': { backgroundColor: 'transparent' },
    '&.MuiTableRow-hover:hover .MuiTableCell-root': {
      backgroundColor: ROW_HOVER_COLOR
    },
    '&.MuiTableRow-hover:hover .MuiTableCell-root:first-of-type': {
      borderRadius: '14px 0 0 14px'
    },
    '&.MuiTableRow-hover:hover .MuiTableCell-root:last-of-type': {
      borderRadius: '0 14px 14px 0'
    },
    '& .MuiTableCell-root:last-of-type': { paddingRight: `${paddingX}px` }
  }
}

/**
 * Moves the focus to the `ROW_FOCUS_ATTRIBUTE` control of the row after
 * (`1`) or before (`-1`) the row holding `from`; from outside the rows, to
 * the first row. Virtuoso renders rows beyond the viewport, and focusing
 * one scrolls it into view. Returns whether the focus moved.
 */
export function moveRowFocus(
  table: Element,
  from: Element | null,
  direction: 1 | -1
): boolean {
  const row = from?.closest('tr') ?? null
  const sibling =
    row === null || !table.contains(row)
      ? table.querySelector(`tr [${ROW_FOCUS_ATTRIBUTE}]`)?.closest('tr')
      : direction === 1
        ? row.nextElementSibling
        : row.previousElementSibling
  const target = sibling?.querySelector(`[${ROW_FOCUS_ATTRIBUTE}]`)
  if (!(target instanceof HTMLElement)) return false
  target.focus()
  return true
}

/**
 * ArrowDown / ArrowUp move the focus to the same control of the next or
 * previous row.
 */
function handleArrowKeys(event: KeyboardEvent<HTMLTableElement>): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  if (!(event.target instanceof HTMLElement)) return
  if (!event.target.hasAttribute(ROW_FOCUS_ATTRIBUTE)) return
  if (
    moveRowFocus(
      event.currentTarget,
      event.target,
      event.key === 'ArrowDown' ? 1 : -1
    )
  ) {
    event.preventDefault()
  }
}

/** Follows the width of the scroller, for the compact columns */
function useWidthObserver(
  node: HTMLDivElement | null,
  onWidthChange: ((width: number) => void) | null
): void {
  useEffect(() => {
    if (node === null || onWidthChange === null) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width !== undefined) onWidthChange(width)
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [node, onWidthChange])
}

const Scroller = forwardRef<HTMLDivElement, ScrollerProps>(function Scroller(
  { context: _context, ...props },
  ref
) {
  const { onWidthChange } = useContext(ListTableContext)
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  // Virtuoso needs the element too: both get it
  const handleRef = useCallback(
    (element: HTMLDivElement | null): void => {
      setNode(element)
      if (typeof ref === 'function') ref(element)
      else if (ref !== null) ref.current = element
    },
    [ref]
  )
  useWidthObserver(node, onWidthChange)
  return (
    <TableContainer
      {...props}
      ref={handleRef}
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

/** The menu key, or Shift+F10: the keyboard way to a context menu */
function isMenuKey(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)
}

function ListTableRow({
  item,
  context,
  ...props
}: TableRowProps): ReactElement {
  const { getRowProps, onRowMenu, onRowDragStart, rowLayout } =
    useContext(ListTableContext)
  // The menu key may also send a contextmenu event: open the menu once
  const openedByKey = useRef(false)

  const handleContextMenu = (event: MouseEvent<HTMLElement>): void => {
    if (onRowMenu === null) return
    event.preventDefault()
    if (openedByKey.current) {
      openedByKey.current = false
      return
    }
    // A keyboard contextmenu event has no pointer position
    if (event.clientX === 0 && event.clientY === 0) {
      onRowMenu(item, { element: event.currentTarget })
    } else {
      onRowMenu(item, {
        position: { left: event.clientX, top: event.clientY }
      })
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (onRowMenu === null || !isMenuKey(event)) return
    event.preventDefault()
    openedByKey.current = true
    window.setTimeout(() => {
      openedByKey.current = false
    }, 0)
    onRowMenu(item, { element: event.currentTarget })
  }
  const handleDragStart = (event: DragEvent<HTMLElement>): void => {
    onRowDragStart?.(item, event)
  }

  return (
    <TableRow
      {...props}
      {...getRowProps?.(item)}
      // 1 is the header row
      aria-rowindex={props['data-index'] + 2}
      selected={context.isSelectedItem(item)}
      hover
      sx={
        rowLayout === null
          ? ROW_SX
          : { ...ROW_SX, ...makeRowLayoutSx(rowLayout) }
      }
      {...(onRowMenu === null
        ? {}
        : { onContextMenu: handleContextMenu, onKeyDown: handleKeyDown })}
      {...(onRowDragStart === null
        ? {}
        : { draggable: true, onDragStart: handleDragStart })}
    />
  )
}

/**
 * Room after the last row, scrolled with the rows: virtuoso makes its footer
 * sticky, this one drops that style. Hidden to screen readers
 */
const SpacerTableFoot = forwardRef<HTMLTableSectionElement, TableFootProps>(
  function SpacerTableFoot(
    { context: _context, style: _style, ...props },
    ref
  ) {
    return <tfoot {...props} ref={ref} aria-hidden="true" />
  }
)

function renderSpacer(height: number, columnCount: number): ReactElement {
  return (
    <tr>
      <Box component="td" colSpan={columnCount} sx={{ height, padding: 0 }} />
    </tr>
  )
}

const COMPONENTS: TableComponents = {
  Scroller,
  Table: ListTable,
  TableHead: HiddenTableHead,
  TableBody: ListTableBody,
  TableRow: ListTableRow,
  TableFoot: SpacerTableFoot
}

export interface VirtualizedListTableProps extends Omit<
  VirtualizedTableProps,
  'components'
> {
  /** Accessible name of the table, e.g. "Messages" */
  label: string
  /**
   * Fewer, richer columns for a narrow table (a phone, a list beside an
   * open item): used while the table is narrower than 600 px. The rows grow
   * to their content
   */
  compactColumns?: VirtualizedTableColumn[]
  /** Forces the compact columns, whatever the width */
  compact?: boolean
  /**
   * The padding of the rows and the gap between their cells, with the wide
   * columns only (the compact ones keep the theme's cell padding)
   */
  rowLayout?: RowLayout
  /** The same, with the compact columns */
  compactRowLayout?: RowLayout
  /** Free room after the last row, e.g. for a floating button, in pixels */
  bottomInset?: number
  /** Number of rows of the whole list, loaded or not; null when unknown */
  rowCount?: number | null
  /** Attributes of the `tr` of a row: `data-*` ids and states, `aria-*` */
  getRowProps?: (row: VirtualizedTableRow) => RowAttributes
  /**
   * Opens the menu of a row: right click (at the pointer), the menu key or
   * Shift+F10 (under the row)
   */
  onRowMenu?: (row: VirtualizedTableRow, anchor: RowMenuAnchor) => void
  /** Makes the rows draggable; set the dragged data on the event */
  onRowDragStart?: (
    row: VirtualizedTableRow,
    event: DragEvent<HTMLElement>
  ) => void
  /**
   * Row to show and focus when the table mounts, e.g. the email the user
   * comes back from: its `RowLink` gets the focus, its position the scroll
   */
  focusedRowIndex?: number | null
  'data-testid'?: string
}

/** Frames to wait for the row to focus to be rendered */
const FOCUS_FRAMES = 60

/**
 * Focuses the `ROW_FOCUS_ATTRIBUTE` element of a row once it is rendered.
 * The list may render its rows again while it settles (React 19 commits them
 * later than React 18 did), and a menu or a dialog closing as the list
 * shows gives the focus back to an opener now gone: while the frames last,
 * a focus lost (back on the body) is given to the row again, at its latest
 * index (rows above it may have left meanwhile).
 */
function useFocusRowOnMount(tableId: string, index: number | null): void {
  const indexRef = useRef(index)
  useEffect(() => {
    indexRef.current = index
  }, [index])
  useEffect(() => {
    if (indexRef.current === null) return
    let frame = 0
    let handle = 0
    let focused: HTMLElement | null = null
    const tryFocus = (): void => {
      const target = document
        .getElementById(tableId)
        ?.querySelector(
          `tr[data-index="${String(indexRef.current)}"] [${ROW_FOCUS_ATTRIBUTE}]`
        )
      const lostFocus =
        focused === null || document.activeElement === document.body
      if (target instanceof HTMLElement && lostFocus) {
        target.focus()
        focused = target
      }
      if (frame < FOCUS_FRAMES) {
        frame += 1
        handle = requestAnimationFrame(tryFocus)
      }
    }
    tryFocus()
    return () => {
      cancelAnimationFrame(handle)
    }
    // On mount only: the frames read the latest index
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
  onRowMenu,
  onRowDragStart,
  columns: wideColumns,
  compactColumns,
  compact = false,
  bottomInset = 0,
  rowLayout,
  compactRowLayout,
  focusedRowIndex = null,
  ...props
}: VirtualizedListTableProps): ReactElement {
  const tableId = useId()
  useFocusRowOnMount(tableId, focusedRowIndex)
  const [isNarrow, setIsNarrow] = useState(false)
  const handleWidthChange = useCallback((width: number): void => {
    // A hidden table measures 0: keep its columns until it shows again
    if (width > 0) setIsNarrow(width < COMPACT_BELOW)
  }, [])
  const isCompact = compactColumns !== undefined && (compact || isNarrow)
  const columns = isCompact ? compactColumns : wideColumns
  const settings = useMemo<ListTableSettings>(
    () => ({
      label,
      rowCount,
      rowLayout: isCompact ? (compactRowLayout ?? null) : (rowLayout ?? null),
      columns,
      getRowProps: getRowProps ?? null,
      onRowMenu: onRowMenu ?? null,
      onRowDragStart: onRowDragStart ?? null,
      onWidthChange: compactColumns === undefined ? null : handleWidthChange
    }),
    [
      label,
      rowCount,
      isCompact,
      rowLayout,
      compactRowLayout,
      columns,
      getRowProps,
      onRowMenu,
      onRowDragStart,
      compactColumns,
      handleWidthChange
    ]
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
        {...(bottomInset > 0
          ? {
              fixedFooterContent: () =>
                renderSpacer(bottomInset, columns.length)
            }
          : {})}
      />
    </ListTableContext.Provider>
  )
}
