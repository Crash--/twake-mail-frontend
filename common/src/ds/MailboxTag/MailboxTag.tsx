// Upstream to twake-ui: no, the look of tmail-flutter's search results
// (`buildMailboxContain`): the folder of a result in a light purple pill
// (#E3E1FD), Inter Medium 10 in dark blue (#162546), at most 100 px wide.
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const TAG_SX = {
  display: 'inline-block',
  flexShrink: 0,
  maxWidth: 100,
  ml: 1,
  px: 1,
  borderRadius: '100px',
  bgcolor: '#E3E1FD',
  color: '#162546',
  fontSize: 10,
  fontWeight: 500,
  lineHeight: '24px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const

export interface MailboxTagProps {
  /** The name of the folder, shown */
  name: string
  /** What screen readers say instead, e.g. "In Inbox" */
  label: string
  'data-testid'?: string
}

/** The folder of an email, in a pill */
export function MailboxTag({
  name,
  label,
  'data-testid': testId
}: MailboxTagProps): ReactElement {
  return (
    <Box component="span" title={name} sx={TAG_SX} data-testid={testId}>
      <span aria-hidden="true">{name}</span>
      <span className="u-visuallyhidden">{label}</span>
    </Box>
  )
}
