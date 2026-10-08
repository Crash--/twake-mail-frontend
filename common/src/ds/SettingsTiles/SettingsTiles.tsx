// Upstream to twake-ui: no, the first level of tmail-flutter's settings on
// phones and tablets (`SettingFirstLevelTileBuilder`): a 24 px icon, the
// name in 16 px, its explanation in grey 13 px under it, a chevron at the
// end, 24 px above and below, a divider between the entries within the
// side margins (16 px on a phone, 32 px on a tablet).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { ElementType, ReactElement, ReactNode } from 'react'

import { Right } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

function sides(isPhone: boolean): string {
  return isPhone ? '16px' : '32px'
}

function listSx(isPhone: boolean): Record<string, unknown> {
  return {
    listStyle: 'none',
    m: 0,
    p: 0,
    // Under the account too, as tmail-flutter: a divider before each entry
    '& > li::before': {
      content: '""',
      display: 'block',
      height: '1px',
      mx: sides(isPhone),
      bgcolor: 'rgba(0, 0, 0, 0.12)'
    }
  }
}

function tileSx(isPhone: boolean): Record<string, unknown> {
  return {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    py: '24px',
    px: sides(isPhone),
    gap: '12px',
    textAlign: 'start',
    color: '#000000',
    textDecoration: 'none'
  }
}

const NAME_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '24px',
  color: '#000000',
  // The blue icons of tmail-flutter's settings
  '& svg': { color: '#007AFF', flexShrink: 0 }
} as const

const EXPLANATION_SX = {
  display: 'block',
  mt: '12px',
  ml: '36px',
  fontSize: 13,
  lineHeight: '18px',
  color: '#6D7885'
} as const

const CHEVRON_SX = { display: 'flex', color: '#B8C1CC' } as const

const ACCOUNT_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  py: '12px',
  fontSize: 17,
  fontWeight: 500,
  color: '#000000',
  wordBreak: 'break-all'
} as const

export interface SettingsAccountProps {
  /** The avatar of the user, 51 px */
  avatar: ReactNode
  /** The address of the user */
  children: ReactNode
}

/** Who is signed in, above the entries */
export function SettingsAccount({
  avatar,
  children
}: SettingsAccountProps): ReactElement {
  const isPhone = useScreenSize() === 'mobile'
  return (
    <Box sx={{ ...ACCOUNT_SX, px: sides(isPhone) }}>
      {avatar}
      <span>{children}</span>
    </Box>
  )
}

export interface SettingsTileListProps {
  children: ReactNode
}

/** The entries of the settings, divided */
export function SettingsTileList({
  children
}: SettingsTileListProps): ReactElement {
  const isPhone = useScreenSize() === 'mobile'
  return (
    <Box component="ul" sx={listSx(isPhone)}>
      {children}
    </Box>
  )
}

export interface SettingsTileProps {
  icon: IconProps['icon']
  title: string
  /** Under the title; null for none */
  explanation: string | null
  /** A link component (e.g. the router `Link`) and where it goes */
  component?: ElementType
  to?: string
  /** For an entry that acts rather than goes somewhere (sign out) */
  onClick?: () => void
  'data-testid'?: string
}

/** An entry of the settings: a link to its section, or a button */
export function SettingsTile({
  icon,
  title,
  explanation,
  component,
  to,
  onClick,
  'data-testid': testId
}: SettingsTileProps): ReactElement {
  const linkProps = component === undefined ? {} : { component, to }
  const isPhone = useScreenSize() === 'mobile'
  return (
    <Box component="li">
      <ButtonBase
        {...linkProps}
        onClick={onClick}
        sx={tileSx(isPhone)}
        data-testid={testId}
      >
        <Box component="span" sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Box component="span" sx={NAME_SX}>
            <Icon icon={icon} size={24} aria-hidden="true" />
            {title}
          </Box>
          {explanation === null ? null : (
            <Box component="span" sx={EXPLANATION_SX}>
              {explanation}
            </Box>
          )}
        </Box>
        <Box component="span" sx={CHEVRON_SX}>
          <Icon icon={Right} size={20} aria-hidden="true" />
        </Box>
      </ButtonBase>
    </Box>
  )
}
