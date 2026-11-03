import { Typography, type TypographyProps } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

/**
 * `name`, `phoneName`, `compactName`: the sender (`h5`); `address`: its
 * address, `meta`: the date, `compact`: the time and preview of a
 * conversation message, `label`: "To:", "Cc:" (all `body2`, secondary
 * text); `recipient`: a recipient (`body2`, primary text)
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

const STYLES = {
  name: { variant: 'h5' },
  phoneName: { variant: 'h5' },
  compactName: { variant: 'h5' },
  address: { variant: 'body2', color: 'text.secondary' },
  meta: { variant: 'body2', color: 'text.secondary' },
  compact: { variant: 'body2', color: 'text.secondary' },
  label: { variant: 'body2', color: 'text.secondary' },
  recipient: { variant: 'body2' }
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
