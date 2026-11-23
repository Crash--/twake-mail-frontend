import { Typography, type TypographyProps } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

/**
 * `name`, `phoneName`: the sender (`h5`); `compactName`: the sender of a
 * collapsed message (`h5` Regular, Semi Bold when `isStrong`); `compact`: its preview
 * (`body3`, `subtitle2` when `isStrong`, secondary text): Regular when read,
 * Semi Bold when unread, as the rows of the list; `address`: the address of
 * the sender, `meta`: the date, `label`: "To:", "Cc:" (all `body2`,
 * secondary text); `recipient`: a recipient (`body2`, primary text,
 * secondary on a phone)
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
  compactName: { variant: 'h5', sx: { fontWeight: 'fontWeightRegular' } },
  address: { variant: 'body2', color: 'text.secondary' },
  meta: { variant: 'body2', color: 'text.secondary' },
  compact: { variant: 'body3', color: 'text.secondary' },
  label: {
    variant: 'body2',
    color: 'text.secondary',
    // "To:" keeps its width beside an address that breaks inside itself
    sx: { flexShrink: 0, whiteSpace: 'nowrap' }
  },
  recipient: {
    variant: 'body2',
    // A long address breaks anywhere rather than overflowing a phone screen
    sx: { overflowWrap: 'anywhere', [PHONE]: { color: 'text.secondary' } }
  }
} as const satisfies Record<MessageTextVariant, TypographyProps>

const STRONG_STYLES: Partial<Record<MessageTextVariant, TypographyProps>> = {
  // The Semi Bold of h5 itself
  compactName: { sx: {} },
  compact: { variant: 'subtitle2' }
}

export interface MessageTextProps {
  variant: MessageTextVariant
  children: ReactNode
  component?: 'span' | 'p' | 'div'
  noWrap?: boolean
  className?: string
  /** Semi Bold: the sender and preview of an unread collapsed message */
  isStrong?: boolean
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
  isStrong = false,
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
      {...(isStrong ? STRONG_STYLES[variant] : {})}
    >
      {children}
    </Typography>
  )
}
