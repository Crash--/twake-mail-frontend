// Upstream to twake-ui: no. The lists of the settings, as the Figma's
// Profiles: 628 px wide, rows split by a divider 8 px away, each a 56 px
// list item (the radio of the default one, the name in `body1` and the
// details in `caption`, its icon buttons at the end), and under it what
// the row holds, e.g. the signature as it is written, 16 px in. The rules
// keep their rows on the grey of the page instead (`look="filled"`).
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { RowHoverActions } from '@/ds/RowHoverActions/RowHoverActions'
import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  maxWidth: 628,
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: { maxWidth: 'none' },
  // Rows on the grey of the page instead of dividers, 8 px apart
  '&[data-look="filled"] > li': {
    p: 0,
    border: 0,
    borderRadius: '10px',
    bgcolor: 'background.default'
  },
  '&[data-look="filled"] > li + li': { mt: 1 }
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
  /** `ruled`: rows split by a divider; `filled`: rows on a grey background */
  look?: 'ruled' | 'filled'
  'data-testid'?: string
}

/** A list of a settings section */
export function SettingsList({
  label,
  children,
  look = 'ruled',
  'data-testid': testId
}: SettingsListProps): ReactElement {
  return (
    <Box
      component="ul"
      aria-label={label}
      sx={LIST_SX}
      data-look={look}
      data-testid={testId}
    >
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
  /**
   * Shows the actions only while the row is hovered or holds the focus,
   * always on a screen without hover (`RowHoverActions`)
   */
  isActionsOnHover?: boolean
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
  isActionsOnHover = false,
  footer,
  'data-testid': testId,
  dataAttributes
}: SettingsListItemProps): ReactElement {
  const actionsBox =
    actions === undefined ? null : <Box sx={ACTIONS_SX}>{actions}</Box>
  return (
    <Box
      component="li"
      sx={ITEM_SX}
      data-testid={testId}
      data-settings-item=""
      {...dataAttributes}
    >
      <Box sx={ROW_SX}>
        {leading}
        <Box sx={CONTENT_SX}>{children}</Box>
        {isActionsOnHover && actionsBox !== null ? (
          <RowHoverActions in="settingsItem">{actionsBox}</RowHoverActions>
        ) : (
          actionsBox
        )}
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

const NAME_LINE_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  minWidth: 0
} as const

const ELLIPSIS_SX = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

// A long chip never hides the name: the name keeps up to half the line
const LINE_NAME_SX = {
  ...NAME_SX,
  ...ELLIPSIS_SX,
  flexShrink: 0,
  maxWidth: '50%'
} as const

const LINE_CHIP_SX = { display: 'flex', minWidth: 0 } as const

export interface SettingsListNameLineProps {
  name: ReactNode
  /** After the name, e.g. a `Chip` saying what the row does; null for none */
  chip: ReactNode | null
  'data-testid'?: string
}

/** The name of a settings row on one line, cut with an ellipsis, then a chip */
export function SettingsListNameLine({
  name,
  chip,
  'data-testid': testId
}: SettingsListNameLineProps): ReactElement {
  return (
    <Box sx={NAME_LINE_SX}>
      <Typography
        component="p"
        sx={chip === null ? { ...NAME_SX, ...ELLIPSIS_SX } : LINE_NAME_SX}
        data-testid={testId}
      >
        {name}
      </Typography>
      {chip === null ? null : <Box sx={LINE_CHIP_SX}>{chip}</Box>}
    </Box>
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
