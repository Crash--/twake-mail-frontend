// Upstream to twake-ui: partly, with `MessageAlert`: twake-mui's `Alert`
// is a live region (`role="alert"`) and does not say its level in text.
// See docs/twake-mui-gaps.md "Message alerts".
import { Alert, Box, type AlertProps } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import type { MessageAlertLevel } from '@/ds/MessageAlert/MessageAlert'
import { VISUALLY_HIDDEN } from '@/ds/MessageAlert/visuallyHidden'

const SEVERITIES: Record<MessageAlertLevel, AlertProps['severity']> = {
  info: 'info',
  warn: 'warning',
  error: 'error'
}

export interface InlineAlertProps {
  level: MessageAlertLevel
  /** The level in words ("Warning"), read before the message */
  levelLabel: string
  /** One sentence about the section it sits above */
  children: string
  className?: string
  'data-testid'?: string
}

/**
 * A one-line warning above a section of a message (the attachments): an
 * icon and a sentence on a tinted background, without title nor action.
 * A static `note`, not a live region; the level is in the text.
 */
export function InlineAlert({
  level,
  levelLabel,
  children,
  className,
  'data-testid': testId
}: InlineAlertProps): ReactElement {
  return (
    <Alert
      role="note"
      severity={SEVERITIES[level]}
      className={className}
      data-testid={testId}
      sx={{ overflowWrap: 'anywhere' }}
    >
      <Box component="span" sx={VISUALLY_HIDDEN}>{`${levelLabel}: `}</Box>
      {children}
    </Alert>
  )
}
