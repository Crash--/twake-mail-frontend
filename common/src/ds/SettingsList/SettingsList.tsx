// Upstream to twake-ui: no, the lists of tmail-flutter's settings
// (identities, rules): rows split by a light divider (black at 8 %), the
// content in a 280 px column on a desktop with the actions right after it,
// the name in Medium 16 black and the details in 12 px steel grey.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const LIST_SX = { listStyle: 'none', m: 0, p: 0 } as const

const ITEM_SX = {
  display: 'flex',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: '6px',
  py: 2,
  borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
} as const

const CONTENT_SX = {
  width: 280,
  maxWidth: '100%',
  minWidth: 0,
  pt: '10px',
  pr: '12px',
  overflowWrap: 'anywhere',
  [`@media ${SCREEN_QUERIES.mobile}`]: { width: 'auto', flex: '1 1 0' }
} as const

const ACTIONS_SX = {
  display: 'flex',
  alignItems: 'center',
  pt: '10px'
} as const

const NAME_SX = {
  fontSize: 16,
  lineHeight: '20px',
  fontWeight: 500,
  color: '#000000',
  mb: 1
} as const

const DETAIL_SX = {
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 500,
  letterSpacing: '0.4px',
  color: '#818C99',
  mb: 1
} as const

export interface SettingsListProps {
  label?: string
  children: ReactNode
  'data-testid'?: string
}

/** A list of a settings section */
export function SettingsList({
  label,
  children,
  'data-testid': testId
}: SettingsListProps): ReactElement {
  return (
    <Box component="ul" aria-label={label} sx={LIST_SX} data-testid={testId}>
      {children}
    </Box>
  )
}

export interface SettingsListItemProps {
  /** Before the content, e.g. the radio choosing the default one */
  leading?: ReactNode
  /** The name and details */
  children: ReactNode
  /** Right after the content, e.g. "Edit" and "Delete" */
  actions?: ReactNode
  'data-testid'?: string
  /** `data-*` attributes of the row */
  dataAttributes?: Record<`data-${string}`, string | boolean | undefined>
}

/** A row of a settings list */
export function SettingsListItem({
  leading,
  children,
  actions,
  'data-testid': testId,
  dataAttributes
}: SettingsListItemProps): ReactElement {
  return (
    <Box component="li" sx={ITEM_SX} data-testid={testId} {...dataAttributes}>
      {leading}
      <Box sx={CONTENT_SX}>{children}</Box>
      {actions === undefined ? null : <Box sx={ACTIONS_SX}>{actions}</Box>}
    </Box>
  )
}

export interface SettingsListTextProps {
  children: ReactNode
  /** `name`: Medium 16 black; `detail`: 12 px steel grey */
  variant: 'name' | 'detail'
  className?: string
  'data-testid'?: string
}

/** A line of the content of a settings row */
export function SettingsListText({
  children,
  variant,
  className,
  'data-testid': testId
}: SettingsListTextProps): ReactElement {
  return (
    <Typography
      component="p"
      className={className}
      sx={variant === 'name' ? NAME_SX : DETAIL_SX}
      data-testid={testId}
    >
      {children}
    </Typography>
  )
}
