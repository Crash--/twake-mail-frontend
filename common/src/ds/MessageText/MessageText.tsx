// Upstream to twake-ui: no, the look of tmail-flutter's reading view, which
// the theme has no variants for: the sender in Medium 15/20 black, its
// address in Medium 14 grey (#6D7885), the date in Regular 14 grey, the
// "To:" in light steel grey (#9AA7B6) and the recipients in black.
import { Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

/**
 * `name`, `compactName`: the sender (Medium 15/20, black); `address`: its
 * address (Medium 14, grey); `meta`: the date (Regular 14, grey);
 * `compact`: the time and preview of a conversation message (Regular 14/20,
 * grey); `label`: "To:", "Cc:" (Regular 14, light grey); `recipient`: a
 * recipient (Regular 14, black)
 */
export type MessageTextVariant =
  | 'name'
  | 'compactName'
  | 'address'
  | 'meta'
  | 'compact'
  | 'label'
  | 'recipient'

const BLACK = TMAIL.textBlack
const GREY = TMAIL.greySlate
const LIGHT_GREY = TMAIL.steelPale

const STYLES = {
  name: { fontSize: 15, lineHeight: '20px', fontWeight: 500, color: BLACK },
  compactName: {
    fontSize: 15,
    lineHeight: '20px',
    fontWeight: 500,
    color: BLACK
  },
  address: { fontSize: 14, lineHeight: '20px', fontWeight: 500, color: GREY },
  meta: { fontSize: 14, lineHeight: '20px', fontWeight: 400, color: GREY },
  compact: { fontSize: 14, lineHeight: '20px', fontWeight: 400, color: GREY },
  label: {
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 400,
    color: LIGHT_GREY
  },
  recipient: {
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 400,
    color: BLACK
  }
} as const

export interface MessageTextProps {
  variant: MessageTextVariant
  children: ReactNode
  component?: 'span' | 'p' | 'div'
  noWrap?: boolean
  className?: string
  id?: string
  'data-testid'?: string
}

/** A piece of text of a message header, as tmail-flutter draws it */
export function MessageText({
  variant,
  children,
  component = 'span',
  noWrap,
  className,
  id,
  'data-testid': testId
}: MessageTextProps): ReactElement {
  return (
    <Typography
      component={component}
      noWrap={noWrap}
      className={className}
      id={id}
      data-testid={testId}
      sx={{ ...STYLES[variant], letterSpacing: 0 }}
    >
      {children}
    </Typography>
  )
}
