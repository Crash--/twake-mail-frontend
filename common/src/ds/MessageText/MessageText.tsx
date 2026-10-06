// Upstream to twake-ui: yes, as typography variants. The reading view and the
// compact conversation of the Teammail 1.1 mocks use sizes the theme has no
// variant for (Bold 17/24, Medium 15/20, Medium 14/18.4).
import { alpha, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

/**
 * `name`: the sender of an open email (Bold 17/24); `compactName`: the
 * sender in a conversation (Medium 15/20); `address`: body1 16/21;
 * `meta`: date, recipients (Medium 14/18.4, secondary); `compact`: the time
 * and preview of a conversation message (Regular 14/20, secondary)
 */
export type MessageTextVariant =
  'name' | 'compactName' | 'address' | 'meta' | 'compact'

const STYLES = {
  name: { fontSize: 17, lineHeight: '24px', fontWeight: 700 },
  compactName: { fontSize: 15, lineHeight: '20px', fontWeight: 500 },
  address: { fontSize: 16, lineHeight: '21px', fontWeight: 400 },
  meta: { fontSize: 14, lineHeight: '18.4px', fontWeight: 500 },
  compact: { fontSize: 14, lineHeight: '20px', fontWeight: 400 }
} as const

const LETTER_SPACING = {
  name: '-0.15px',
  compactName: '-0.15px',
  address: '-0.15px',
  meta: '0.1px',
  compact: '0.1px'
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

/**
 * A piece of text of a message header, in the size of the mocks. The
 * secondary variants use Grey 900 at 80 %, the AA contrast of `SecondaryText`.
 */
export function MessageText({
  variant,
  children,
  component = 'span',
  noWrap,
  className,
  id,
  'data-testid': testId
}: MessageTextProps): ReactElement {
  const isSecondary = variant === 'meta' || variant === 'compact'
  return (
    <Typography
      component={component}
      noWrap={noWrap}
      className={className}
      id={id}
      data-testid={testId}
      sx={theme => ({
        ...STYLES[variant],
        letterSpacing: LETTER_SPACING[variant],
        ...(isSecondary
          ? {
              color: alpha(theme.palette.grey[900], 0.8),
              ...theme.applyStyles('dark', {
                color: alpha(theme.palette.common.white, 0.8)
              })
            }
          : {})
      })}
    >
      {children}
    </Typography>
  )
}
