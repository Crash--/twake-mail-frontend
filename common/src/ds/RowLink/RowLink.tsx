// Upstream to twake-ui: yes, with `VirtualizedTable` (a `getRowHref` option
// rendering it). A table row cannot be an `<a>`: a link stretched over its
// row is how a row opens like a link (middle click, Ctrl+click, "Open in a
// new tab", keyboard focus) without breaking the table semantics.
import { Link } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, ReactNode } from 'react'

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
  'data-testid'?: string
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
  'data-testid': testId
}: RowLinkProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    onNavigate()
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      variant="body1"
      color="inherit"
      underline="none"
      className="u-db u-ellipsis"
      {...{ [ROW_FOCUS_ATTRIBUTE]: true }}
      data-testid={testId}
      sx={theme => ({
        '&::after': { content: '""', position: 'absolute', inset: 0 },
        '&:focus-visible': { outline: 'none' },
        '&:focus-visible::after': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '-2px'
        }
      })}
    >
      {children}
    </Link>
  )
}
