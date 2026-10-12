// Upstream to twake-ui: no, the look of tmail-flutter's compact mail rows
// (`EmailTileBuilder`, phones and tablets): the sender in 15 px with its
// marks and the date at the end of the first line, then a chevron; the
// subject on the second line, the preview on the third, each cut with an
// ellipsis.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { ROW_MUTED_COLOR, rowSenderSx, rowTextSx } from '@/ds/RowLine/rowText'

const LINE_SX = {
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  gap: '8px'
} as const

const END_SX = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  gap: '8px',
  '& > *': { flexShrink: 0 }
} as const

const CUT_SX = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

export interface CompactRowLinesProps {
  /** Before the sender: the unread dot */
  marker?: ReactNode
  /** The name(s) of the sender */
  sender: ReactNode
  /** After the sender: answered, attachment icons, then the date */
  senderEnd?: ReactNode
  /** At the very end of the first line, e.g. a chevron */
  end?: ReactNode
  subject: ReactNode
  /** After the subject: the folder, the star */
  subjectEnd?: ReactNode
  preview: ReactNode
  /** After the preview: the labels */
  previewEnd?: ReactNode
  /** Unread: the sender and the subject Semi Bold and black */
  isStrong?: boolean
  testIds?: { sender?: string; subject?: string; preview?: string }
}

/** The three lines of a compact mail row */
export function CompactRowLines({
  marker,
  sender,
  senderEnd,
  end,
  subject,
  subjectEnd,
  preview,
  previewEnd,
  isStrong = false,
  testIds = {}
}: CompactRowLinesProps): ReactElement {
  return (
    <Box
      component="span"
      sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}
    >
      <Box component="span" sx={LINE_SX}>
        {marker}
        <Box
          component="span"
          sx={{ ...rowSenderSx(isStrong), ...CUT_SX }}
          data-testid={testIds.sender}
        >
          {sender}
        </Box>
        {/* Never cut: the name gives way */}
        <Box component="span" sx={END_SX}>
          {senderEnd}
          {end}
        </Box>
      </Box>
      <Box component="span" sx={LINE_SX}>
        <Box
          component="span"
          sx={{ ...rowTextSx(isStrong), ...CUT_SX }}
          data-testid={testIds.subject}
        >
          {subject}
        </Box>
        {subjectEnd}
      </Box>
      <Box component="span" sx={LINE_SX}>
        <Box
          component="span"
          sx={{ ...rowTextSx(false), color: ROW_MUTED_COLOR, ...CUT_SX }}
          data-testid={testIds.preview}
        >
          {preview}
        </Box>
        {previewEnd}
      </Box>
    </Box>
  )
}
