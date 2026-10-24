import { Typography, type TypographyProps } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

/**
 * `name`, `phoneName`, `compactName`: the sender (`h5`); `address`: its
 * address, `meta`: the date, `compact`: the time and preview of a
 * conversation message, `label`: "To:", "Cc:" (all `body2`, secondary
 * text); `recipient`: a recipient (`body2`, primary text, secondary on a
 * phone)
 */
export type MessageTextVariant =
  | 'name'
  | 'phoneName'
  | 'compactName'
  | 'address'
  | 'meta'
  | 'compact'
  | 'label'
  | 'recipient'

const PHONE = `@media ${SCREEN_QUERIES.mobile}`

const STYLES = {
  name: { variant: 'h5' },
  phoneName: { variant: 'h5' },
  compactName: { variant: 'h5' },
  address: { variant: 'body2', color: 'text.secondary' },
  meta: { variant: 'body2', color: 'text.secondary' },
  compact: { variant: 'body2', color: 'text.secondary' },
  label: { variant: 'body2', color: 'text.secondary' },
  recipient: {
    variant: 'body2',
    sx: { [PHONE]: { color: 'text.secondary' } }
  }
} as const satisfies Record<MessageTextVariant, TypographyProps>

export interface MessageTextProps {
  variant: MessageTextVariant
  children: ReactNode
  component?: 'span' | 'p' | 'div'
  noWrap?: boolean
  className?: string
  id?: string
  'data-testid'?: string
}

/** A piece of text of a message header */
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
      {...STYLES[variant]}
    >
      {children}
    </Typography>
  )
}
