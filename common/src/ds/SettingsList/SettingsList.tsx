// Upstream to twake-ui: no. The lists of the settings, as the Figma's
// Profiles: 628 px wide, rows split by a divider 8 px away, each a 56 px
// list item (the radio of the default one, the name in `body1` and the
// details in `caption`, its icon buttons at the end), and under it what
// the row holds, e.g. the signature as it is written, 16 px in.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  maxWidth: 628,
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: { maxWidth: 'none' }
} as const

const ITEM_SX = {
  '& + &': { pt: 1 },
  '&:not(:last-of-type)': {
    pb: 1,
    borderBottom: '1px solid',
    borderColor: 'divider'
  }
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  minHeight: 56,
  boxSizing: 'border-box',
  pl: 2,
  py: '12px'
} as const

const CONTENT_SX = {
  flex: '1 1 0',
  minWidth: 0,
  overflowWrap: 'anywhere'
} as const

const ACTIONS_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  pr: '4px'
} as const

const FOOTER_SX = { p: 2 } as const

const NAME_SX = { typography: 'body1', color: 'text.primary' } as const

const DETAIL_SX = {
  mt: '1px',
  typography: 'caption',
  color: 'text.secondary'
} as const

/** A signature as the mail shows it, 150 px high at most */
const HTML_SX = {
  maxHeight: 150,
  overflow: 'hidden',
  typography: 'body2',
  color: 'text.primary',
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
  /** At the end of the row, e.g. "Edit" and "Delete" */
  actions?: ReactNode
  /** Under the row, e.g. the signature */
  footer?: ReactNode
  'data-testid'?: string
  /** `data-*` attributes of the row */
  dataAttributes?: Record<`data-${string}`, string | boolean | undefined>
}

/** A row of a settings list */
export function SettingsListItem({
  leading,
  children,
  actions,
  footer,
  'data-testid': testId,
  dataAttributes
}: SettingsListItemProps): ReactElement {
  return (
    <Box component="li" sx={ITEM_SX} data-testid={testId} {...dataAttributes}>
      <Box sx={ROW_SX}>
        {leading}
        <Box sx={CONTENT_SX}>{children}</Box>
        {actions === undefined ? null : <Box sx={ACTIONS_SX}>{actions}</Box>}
      </Box>
      {footer === undefined ? null : <Box sx={FOOTER_SX}>{footer}</Box>}
    </Box>
  )
}

export interface SettingsListTextProps {
  children: ReactNode
  /** `name`: `body1`; `detail`: `caption` in `text.secondary` */
  variant: 'name' | 'detail'
  className?: string
  'data-testid'?: string
}

const TEXT_SX = { name: NAME_SX, detail: DETAIL_SX } as const

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
