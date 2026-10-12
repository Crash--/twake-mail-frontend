// Upstream to twake-ui: yes, with `VirtualizedTable` row layouts. The sender
// cell of the mail list, as tmail-flutter: a 32 px avatar, 10 px, then the
// name in a block of fixed width (160 px), so that the subjects line up
// whatever the names, 24 px after it.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { rowSenderSx } from '@/ds/RowLine/rowText'

/** Width of the avatar, in px */
const AVATAR_WIDTH = 32
/** Between the avatar and the name, in px */
const AVATAR_GAP = 10
/** Width of the name block, in px */
export const SENDER_BLOCK_WIDTH = 160
/** Between the name block and the subject, in px */
const SENDER_GAP = 24

/** Width of the avatar, the name block and the gap after it, in px */
export const SENDER_WIDTH =
  AVATAR_WIDTH + AVATAR_GAP + SENDER_BLOCK_WIDTH + SENDER_GAP

export interface RowSenderProps {
  /** A 32 px avatar */
  avatar: ReactNode
  /** The name(s) of the sender, cut with an ellipsis */
  children: ReactNode
  /** After the name, never cut (the number of messages of a conversation) */
  trailing?: ReactNode
  /** The row stands out (unread): the name is Semi Bold and black */
  isStrong?: boolean
  /** On the name */
  'data-testid'?: string
}

/** The avatar and name of a sender in a list row. */
export function RowSender({
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
      sx={{ gap: `${AVATAR_GAP}px`, pr: `${SENDER_GAP}px` }}
    >
      {avatar}
      <Box
        component="span"
        className="u-flex u-flex-items-center"
        sx={{ width: SENDER_BLOCK_WIDTH, minWidth: 0 }}
      >
        <Box
          component="span"
          className="u-ellipsis"
          sx={{ ...rowSenderSx(isStrong), flex: '0 1 auto', minWidth: 0 }}
          data-testid={testId}
        >
          {children}
        </Box>
        {trailing}
      </Box>
    </Box>
  )
}
