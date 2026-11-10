// Upstream to twake-ui: no. The settings menu of the Figma ("SidebarSettingMail"):
// groups 8 px apart under a `caption` title, rows of 36 px with a 16 px icon
// and the name in `body2`, both in `primary.main` on `action.selected` once
// selected. twake-mui's `NavigationList` is not used: its rows are not links
// with `aria-current`.
import { Box, ButtonBase, List } from '@linagora/twake-mui'
import type { ElementType, ReactElement, ReactNode } from 'react'

import { Icon, type IconProps } from '@/ds/Icon/Icon'

function itemSx(isSelected: boolean): Record<string, unknown> {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '12px',
    width: '100%',
    minHeight: 36,
    boxSizing: 'border-box',
    px: 1,
    py: '5px',
    borderRadius: '8px',
    bgcolor: isSelected ? 'action.selected' : 'transparent',
    color: isSelected ? 'primary.main' : 'text.primary',
    typography: 'body2',
    textAlign: 'start',
    '& .SettingsMenu-icon': { display: 'flex' },
    '&:hover': { bgcolor: isSelected ? 'action.selected' : 'action.hover' }
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
  display: 'flex',
  alignItems: 'center',
  minHeight: 36,
  boxSizing: 'border-box',
  m: 0,
  px: 1,
  typography: 'caption',
  color: 'text.secondary'
} as const

const GROUPS_SX = { display: 'flex', flexDirection: 'column', gap: 1 } as const

export interface SettingsMenuTitleProps {
  id?: string
  children: ReactNode
}

/** The title above a group of a settings menu, e.g. "Manage account" */
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

export interface SettingsMenuGroupsProps {
  children: ReactNode
}

/** The titles and lists of a settings menu, 8 px apart */
export function SettingsMenuGroups({
  children
}: SettingsMenuGroupsProps): ReactElement {
  return <Box sx={GROUPS_SX}>{children}</Box>
}

export interface SettingsMenuListProps {
  children: ReactNode
}

/** The list of the entries of a settings menu */
export function SettingsMenuList({
  children
}: SettingsMenuListProps): ReactElement {
  return <List disablePadding>{children}</List>
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
          <Icon icon={icon} size={16} aria-hidden="true" />
        </span>
        <Box component="span" sx={NAME_SX}>
          {label}
        </Box>
      </ButtonBase>
    </Box>
  )
}
