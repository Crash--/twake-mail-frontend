// Upstream to twake-ui: yes. A list and the item opened from it, one at a
// time or side by side depending on the room, is the master-detail pattern
// of every Twake app (mails, contacts, files); twake-mui has none.
import { Box } from '@linagora/twake-mui'
import {
  useEffect,
  useRef,
  type FocusEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/** Width of the list beside an open item (tmail-flutter tablet layout) */
export const SPLIT_LIST_WIDTH = 375

const LIST_PANE_SX = {
  width: SPLIT_LIST_WIDTH,
  borderRight: 1,
  borderColor: 'divider'
} as const

export interface ListDetailLayoutProps {
  list: ReactNode
  /** The item opened from the list, null when none is */
  detail: ReactNode
  /** Beside the list when no item is open, on screens showing both */
  placeholder: ReactNode
}

function isFocusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body || !active.isConnected
}

/**
 * A list and the item opened from it.
 *
 * - From 900 to 1199 px, side by side, as tmail-flutter does on large
 *   tablets: the list keeps its width, its scroll and its focus while items
 *   open beside it, and a placeholder fills the room when none is open.
 *   Closing the item gives the focus back to where it was in the list.
 * - Otherwise one at a time, the item replacing the list: phones, small
 *   tablets, and desktops, where the list has the whole width.
 *
 * Only what is shown is rendered: nothing hidden can take the focus.
 */
export function ListDetailLayout({
  list,
  detail,
  placeholder
}: ListDetailLayoutProps): ReactElement {
  const isSplit = useScreenSize() === 'tabletLarge'
  const hasDetail = detail !== null && detail !== undefined
  const lastListFocusRef = useRef<HTMLElement | null>(null)
  const hadDetailRef = useRef(hasDetail)

  useEffect(() => {
    const hadDetail = hadDetailRef.current
    hadDetailRef.current = hasDetail
    const target = lastListFocusRef.current
    if (
      isSplit &&
      hadDetail &&
      !hasDetail &&
      isFocusLost() &&
      target?.isConnected
    ) {
      target.focus()
    }
  }, [isSplit, hasDetail])

  const handleListFocus = (event: FocusEvent<HTMLElement>): void => {
    lastListFocusRef.current = event.target
  }

  if (!isSplit) return <>{hasDetail ? detail : list}</>

  return (
    <Box className="u-flex u-h-100">
      <Box
        className="u-flex u-flex-column u-flex-shrink-0 u-h-100"
        sx={LIST_PANE_SX}
        onFocus={handleListFocus}
      >
        {list}
      </Box>
      <Box className="u-flex-auto u-h-100 u-ov-auto">
        {hasDetail ? detail : placeholder}
      </Box>
    </Box>
  )
}
