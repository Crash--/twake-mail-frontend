// Upstream to twake-ui: no, the lists of tmail-flutter's settings
// (`IdentitiesView`, `IdentityListTileBuilder`): 12 px in at the start, 24 px
// at the end, rows split by a light divider (black at 8 %) 32 px under a row
// and 20 px above the next one, the 18 px radio of the default one in a
// 42 px target, the content in a 280 px column on a desktop with the actions
// right after it (under it on a phone), the name in Medium 16 black, the
// details in 12 px steel grey, the signature as it is written.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const LIST_SX = {
  listStyle: 'none',
  m: 0,
  pl: '12px',
  pr: '24px',
  pb: '24px'
} as const

const ITEM_SX = {
  display: 'flex',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  columnGap: '6px',
  pt: '20px',
  pb: '32px',
  '&:first-of-type': { pt: 0 },
  borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
  // tmail-flutter's radio: its 18 px ring, 12 px around
  '& .MuiRadio-root': { p: '12px' },
  '& .MuiRadio-root svg': { width: 18, height: 18 },
  [`@media ${SCREEN_QUERIES.mobile}`]: { rowGap: '24px' }
} as const

const CONTENT_SX = {
  width: 280,
  maxWidth: '100%',
  minWidth: 0,
  pt: '10px',
  pr: '12px',
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
  [`@media ${SCREEN_QUERIES.mobile}`]: { width: 'auto', flex: '1 1 0' }
} as const

const ACTIONS_SX = {
  display: 'flex',
  alignItems: 'center',
  pt: '10px',
  [`@media ${SCREEN_QUERIES.mobile}`]: { flexBasis: '100%', pt: 0 }
} as const

// tmail-flutter's Medium, drawn thinner by its canvas: Regular to the eye
const NAME_SX = {
  fontSize: 16,
  lineHeight: '20px',
  fontWeight: 400,
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

/** The "--" before a signature: Regular 15 black */
const MARK_SX = {
  fontSize: 15,
  lineHeight: '20px',
  fontWeight: 400,
  color: '#000000'
} as const

/** A signature as the mail shows it, 150 px high at most */
const HTML_SX = {
  maxHeight: 150,
  overflow: 'hidden',
  fontSize: 16,
  color: '#000000',
  '& img': { maxWidth: '100%', height: 'auto' }
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
  /**
   * `name`: Medium 16 black; `detail`: 12 px steel grey; `mark`: the "--"
   * before a signature, Regular 15 black
   */
  variant: 'name' | 'detail' | 'mark'
  className?: string
  'data-testid'?: string
}

const TEXT_SX = { name: NAME_SX, detail: DETAIL_SX, mark: MARK_SX } as const

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
      sx={TEXT_SX[variant]}
      data-testid={testId}
    >
      {children}
    </Typography>
  )
}

export interface SettingsListHtmlProps {
  /** Safe HTML (sanitized by the caller) */
  html: string
  'data-testid'?: string
}

/** Rich content of a settings row, e.g. a signature, as it is written */
export function SettingsListHtml({
  html,
  'data-testid': testId
}: SettingsListHtmlProps): ReactElement {
  return (
    <Box
      sx={HTML_SX}
      dangerouslySetInnerHTML={{ __html: html }}
      data-testid={testId}
    />
  )
}
