// Upstream to twake-ui: yes, with `VirtualizedTable` (a `getRowHref` option
// rendering it). A table row cannot be an `<a>`: a link stretched over its
// row is how a row opens like a link (middle click, Ctrl+click, "Open in a
// new tab", keyboard focus) without breaking the table semantics.
import { Link } from '@linagora/twake-mui'
import {
  createContext,
  useContext,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  FOCUS_RING,
  FOCUS_RING_INSET
} from '@/ds/FocusIndicator/focusIndicator'
import { useLongPress } from '@/ds/useLongPress/useLongPress'
import { ROW_FOCUS_ATTRIBUTE } from '@/ds/VirtualizedListTable/VirtualizedListTable'

export interface RowLinkProps {
  href: string
  /**
   * In-app navigation for a plain click; any other click (middle, with a
   * modifier key) is left to the browser, which opens `href`.
   */
  onNavigate: () => void
  /** The accessible name of the link, hence of the row */
  children: ReactNode
  /**
   * Content on several lines (a compact row: sender, subject, preview),
   * each line cutting its own overflow; one line with an ellipsis otherwise
   */
  multiline?: boolean
  /**
   * The row is the item open beside the list (`aria-current="true"`: the
   * current folder of the tree is the `page`)
   */
  current?: boolean
  /**
   * A finger held on the row; its end follows no link. A context menu the
   * browser reports for the same press (Android) then reaches nothing else
   */
  onLongPress?: () => void
  'data-testid'?: string
}

const InRowLinkContext = createContext(false)

/**
 * Inside a row link, under its overlay: what must take the pointer (a
 * tooltip) lifts itself above it, and only there, or it would also rise
 * above the sticky bars of the page
 */
export function useIsInRowLink(): boolean {
  return useContext(InRowLinkContext)
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  )
}

/**
 * A link whose clickable area covers its whole table row, inside a
 * `VirtualizedListTable`, in the body text style rather than the look of a
 * link. The other controls of the row stay above it. Its focus ring
 * outlines the row.
 */
export function RowLink({
  href,
  onNavigate,
  children,
  multiline = false,
  current = false,
  onLongPress,
  'data-testid': testId
}: RowLinkProps): ReactElement {
  const longPress = useLongPress(onLongPress)
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    onNavigate()
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      {...longPress.handlers}
      onContextMenu={(event: MouseEvent<HTMLAnchorElement>) => {
        if (longPress.cancel()) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      aria-current={current ? 'true' : undefined}
      variant="body1"
      color="inherit"
      underline="none"
      className={multiline ? 'u-db u-ov-hidden' : 'u-db u-ellipsis'}
      {...{ [ROW_FOCUS_ATTRIBUTE]: true }}
      data-testid={testId}
      sx={{
        '&::after': { content: '""', position: 'absolute', inset: 0 },
        '&:focus-visible': { outline: 'none' },
        '&:focus-visible::after': { ...FOCUS_RING, ...FOCUS_RING_INSET },
        // No link preview nor text selection under the held finger (iOS)
        ...(onLongPress === undefined
          ? {}
          : { WebkitTouchCallout: 'none', userSelect: 'none' })
      }}
    >
      <InRowLinkContext.Provider value>{children}</InRowLinkContext.Provider>
    </Link>
  )
}
