// Upstream to twake-ui: no, the folder of a search result in a pill (at most
// 100 px wide): `action.selected` behind `text.primary`, in the overline
// typography.
import { Box, radius } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const TAG_SX = {
  display: 'inline-block',
  flexShrink: 0,
  maxWidth: 100,
  ml: 1,
  px: 1,
  borderRadius: radius.pill,
  bgcolor: 'action.selected',
  color: 'text.primary',
  typography: 'overline',
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
