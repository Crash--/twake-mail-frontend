// Upstream to twake-ui: yes, with `VirtualizedTable` row layouts. The sender
// cell of the mail list: a 20 px marker frame, then a block of fixed width
// (198 px in the design) holding an avatar and the name, so that the
// subjects line up whatever the names.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { rowTextSx } from '@/ds/RowLine/rowText'

/** Width of the avatar and name block, in px (Figma) */
export const SENDER_BLOCK_WIDTH = 198

/** Width of the marker, the gap and the block, in px */
export const SENDER_WIDTH = 20 + 4 + SENDER_BLOCK_WIDTH

export interface RowSenderProps {
  /** The 20 px frame before the block (the unread dot, or an empty frame) */
  marker: ReactNode
  /** A 20 px avatar */
  avatar: ReactNode
  /** The name(s) of the sender, cut with an ellipsis */
  children: ReactNode
  /** After the name, never cut (the number of messages of a conversation) */
  trailing?: ReactNode
  /** The row stands out (unread): the name is Semi Bold */
  isStrong?: boolean
  /** On the name */
  'data-testid'?: string
}

/** The marker, avatar and name of a sender in a list row. */
export function RowSender({
  marker,
  avatar,
  children,
  trailing,
  isStrong = false,
  'data-testid': testId
}: RowSenderProps): ReactElement {
  return (
    <Box
      component="span"
      className="u-flex u-flex-items-center"
      sx={{ gap: '4px' }}
    >
      {marker}
      <Box
        component="span"
        className="u-flex u-flex-items-center"
        sx={{ width: SENDER_BLOCK_WIDTH, minWidth: 0, gap: 1 }}
      >
        {avatar}
        <Box
          component="span"
          className="u-ellipsis"
          sx={{ ...rowTextSx(isStrong), flex: '0 1 auto', minWidth: 0 }}
          data-testid={testId}
        >
          {children}
        </Box>
        {trailing}
      </Box>
    </Box>
  )
}
