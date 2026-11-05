// Upstream to twake-ui: no. The first level of the settings on phones and
// tablets (Figma "View mobile settings twake UI"): on the grey of the page,
// who is signed in, centred under a back button, then groups of
// full-width rows on paper, each a 20 px icon in a 32 px box, the name in
// body1, its explanation in caption under it, a 24 px chevron at the end,
// the dividers starting under the name.
import { Icon, type IconProps, Right } from '@linagora/twake-icons'
import { Box, ButtonBase, Typography } from '@linagora/twake-mui'
import type { ElementType, ReactElement, ReactNode } from 'react'

/** The icon box (32 px) and the gaps around it: where the dividers start */
const TEXT_INSET = 16 + 32 + 16

const PAGE_SX = {
  minHeight: '100%',
  bgcolor: 'background.default',
  pb: '24px'
} as const

const ACCOUNT_SX = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  pt: '27px',
  pb: '18px',
  // The back button stays above the name: the avatar alone is beside it
  px: '16px',
  textAlign: 'center'
} as const

const BACK_SX = {
  position: 'absolute',
  top: '8px',
  insetInlineStart: '12px'
} as const

const NAME_SX = {
  fontSize: '18px',
  fontWeight: 600,
  lineHeight: '22px',
  color: 'text.primary',
  wordBreak: 'break-word'
} as const

// A long address wraps, its button after its last letter
const ADDRESS_SX = {
  maxWidth: '100%',
  typography: 'body2',
  color: 'text.secondary',
  wordBreak: 'break-all',
  '& > button': { verticalAlign: 'middle', ml: '2px' }
} as const

const LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  bgcolor: 'background.paper',
  '& + &': { mt: '24px' },
  // Between the entries, from under the name to the end of the row
  '& > li + li::before': {
    content: '""',
    display: 'block',
    height: '1px',
    ml: `${TEXT_INSET}px`,
    bgcolor: 'divider'
  }
} as const

const TILE_SX = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minHeight: '56px',
  py: '12px',
  pl: '16px',
  pr: '8px',
  gap: '16px',
  textAlign: 'start',
  color: 'text.primary',
  textDecoration: 'none'
} as const

const ICON_BOX_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '32px',
  height: '32px',
  color: 'text.icon'
} as const

const TEXT_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  flex: '1 1 auto',
  minWidth: 0
} as const

const EXPLANATION_SX = {
  typography: 'caption',
  color: 'text.secondary'
} as const

export interface SettingsTilesPageProps {
  children: ReactNode
}

/** The grey page holding the account and the groups of entries */
export function SettingsTilesPage({
  children
}: SettingsTilesPageProps): ReactElement {
  return <Box sx={PAGE_SX}>{children}</Box>
}

export interface SettingsAccountProps {
  /** The avatar of the user, 48 px */
  avatar: ReactNode
  /** The display name of the user */
  name: string
  /** The address of the user */
  address: string
  /** After the address, e.g. an icon button copying it */
  addressAction?: ReactNode
  /** At the top left, e.g. the button back to the mail */
  back?: ReactNode
}

/** Who is signed in, above the entries */
export function SettingsAccount({
  avatar,
  name,
  address,
  addressAction,
  back
}: SettingsAccountProps): ReactElement {
  return (
    <Box sx={ACCOUNT_SX}>
      {back === undefined ? null : <Box sx={BACK_SX}>{back}</Box>}
      {avatar}
      <Typography component="p" sx={NAME_SX}>
        {name}
      </Typography>
      <Box sx={ADDRESS_SX}>
        <span>{address}</span>
        {addressAction}
      </Box>
    </Box>
  )
}

export interface SettingsTileListProps {
  children: ReactNode
}

/** A group of entries of the settings, divided */
export function SettingsTileList({
  children
}: SettingsTileListProps): ReactElement {
  return (
    <Box component="ul" sx={LIST_SX}>
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
  /** A plain link out of the app (`mailto:`, a page of the support) */
  href?: string
  /** With `href`: opens in a new tab */
  isExternal?: boolean
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
  href,
  isExternal = false,
  'data-testid': testId
}: SettingsTileProps): ReactElement {
  const linkProps =
    href !== undefined
      ? {
          component: 'a' as const,
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
        sx={TILE_SX}
        data-testid={testId}
      >
        <Box component="span" sx={ICON_BOX_SX}>
          <Icon icon={icon} size={20} aria-hidden="true" />
        </Box>
        <Box component="span" sx={TEXT_SX}>
          <Box component="span" sx={{ typography: 'body1' }}>
            {title}
          </Box>
          {explanation === null ? null : (
            <Box component="span" sx={EXPLANATION_SX}>
              {explanation}
            </Box>
          )}
        </Box>
        <Box component="span" sx={ICON_BOX_SX}>
          <Icon icon={Right} size={24} aria-hidden="true" />
        </Box>
      </ButtonBase>
    </Box>
  )
}
