// Upstream to twake-ui: no, the look of tmail-flutter's settings menu
// (`AccountMenuItemTileBuilder`): 36 px rows 4 px apart, a radius of 8, a
// 20 px icon in the primary blue, 8 px, the name in Regular 15 black, Semi
// Bold on a light grey (#EAEDF2) background once selected.
import { type IconProps, Icon } from '@linagora/twake-icons'
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { ElementType, ReactElement, ReactNode } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const LIST_SX = { listStyle: 'none', m: 0, px: 1, py: 0 } as const

function itemSx(isSelected: boolean): Record<string, unknown> {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
    width: '100%',
    height: 36,
    boxSizing: 'border-box',
    p: 1,
    mt: '4px',
    borderRadius: '8px',
    bgcolor: isSelected ? TMAIL.fillSelected : 'transparent',
    // tmail-flutter's black, drawn thinner by its canvas: the near black of
    // its title keeps the same weight to the eye
    color: TMAIL.textOnSurface,
    fontSize: 15,
    lineHeight: '20px',
    fontWeight: isSelected ? 600 : 400,
    letterSpacing: 0,
    textAlign: 'start',
    '& .SettingsMenu-icon': { color: TMAIL.primary, display: 'flex' },
    '&:hover': { bgcolor: isSelected ? TMAIL.fillSelected : TMAIL.hoverBlack }
  }
}

const NAME_SX = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

const TITLE_SX = {
  m: 0,
  p: 1,
  fontSize: 17,
  lineHeight: '22px',
  fontWeight: 700,
  // tmail-flutter's default text colour (`m3SurfaceBackground`)
  color: TMAIL.textOnSurface
} as const

const DIVIDER_SX = {
  mt: '20px',
  mb: '12px',
  border: 0,
  borderTop: `1px solid ${TMAIL.divider12}`
} as const

export interface SettingsMenuTitleProps {
  id?: string
  children: ReactNode
}

/** The title above a settings menu, e.g. "Manage account" */
export function SettingsMenuTitle({
  id,
  children
}: SettingsMenuTitleProps): ReactElement {
  return (
    <Box component="p" id={id} sx={TITLE_SX}>
      {children}
    </Box>
  )
}

/** The line between the sections and the actions of a settings menu */
export function SettingsMenuDivider(): ReactElement {
  return <Box component="hr" sx={DIVIDER_SX} />
}

export interface SettingsMenuListProps {
  children: ReactNode
}

/** The list of the entries of a settings menu */
export function SettingsMenuList({
  children
}: SettingsMenuListProps): ReactElement {
  return (
    <Box component="ul" sx={LIST_SX}>
      {children}
    </Box>
  )
}

export interface SettingsMenuItemProps {
  icon: IconProps['icon']
  label: string
  isSelected?: boolean
  /** A link component (e.g. the router `Link`) and where it goes */
  component?: ElementType
  to?: string
  /** A plain link instead (a `mailto:`, a page in a new tab) */
  href?: string
  /** With `href`: opens it in a new tab */
  isExternal?: boolean
  /** For an entry that acts rather than goes somewhere */
  onClick?: () => void
  'data-testid'?: string
}

/** An entry of a settings menu: a link, `aria-current` once selected */
export function SettingsMenuItem({
  icon,
  label,
  isSelected = false,
  component,
  to,
  href,
  isExternal = false,
  onClick,
  'data-testid': testId
}: SettingsMenuItemProps): ReactElement {
  const linkProps =
    href !== undefined
      ? {
          component: 'a',
          href,
          ...(isExternal
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})
        }
      : component === undefined
        ? {}
        : { component, to }
  return (
    <Box component="li">
      <ButtonBase
        {...linkProps}
        onClick={onClick}
        aria-current={isSelected ? 'page' : undefined}
        sx={itemSx(isSelected)}
        data-testid={testId}
      >
        <span className="SettingsMenu-icon">
          <Icon icon={icon} size={20} aria-hidden="true" />
        </span>
        <Box component="span" sx={NAME_SX}>
          {label}
        </Box>
      </ButtonBase>
    </Box>
  )
}
