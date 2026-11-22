// Upstream to twake-ui: no. The recipients of the forwarding: rows with an
// avatar ruled in one outlined list, under a header selecting them.
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const OUTLINED_SX = {
  width: 628,
  maxWidth: '100%',
  m: 0,
  p: 0,
  listStyle: 'none',
  border: 1,
  borderColor: 'divider',
  borderRadius: '12px',
  overflow: 'hidden'
} as const

const RECIPIENT_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minHeight: 64,
  px: 2,
  '& + &': { borderTop: 1, borderColor: 'divider' },
  '&[data-selected="true"]': { bgcolor: 'action.selected' }
} as const

export interface SettingsRecipientListProps {
  label: string
  children: ReactNode
  'data-testid'?: string
}

/** The recipients of the forwarding: a 628 px outlined list, rows ruled */
export function SettingsRecipientList({
  label,
  children,
  'data-testid': testId
}: SettingsRecipientListProps): ReactElement {
  return (
    <Box
      component="ul"
      aria-label={label}
      sx={OUTLINED_SX}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}

const RECIPIENT_NAME_SX = {
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  typography: 'body1',
  color: 'text.primary',
  '& > span:first-of-type': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }
} as const

const RECIPIENT_STATUS_SX = {
  display: 'flex',
  flexShrink: 0,
  color: 'primary.main'
} as const

export interface SettingsRecipientCardProps {
  /** A 32 px avatar, e.g. a `SelectableAvatar` */
  avatar: ReactNode
  name: string
  /** After the name: a check for the domain, an information else */
  status: ReactNode
  isSelected: boolean
  /** At the end, e.g. delete */
  actions: ReactNode
  'data-testid'?: string
  /** `data-*` attributes of the card */
  dataAttributes?: Record<`data-${string}`, string | undefined>
}

/**
 * A recipient of the forwarding, a row of `SettingsRecipientList`: its
 * avatar, the address and a primary status icon, the delete button at the
 * end; on `action.selected` once selected
 */
export function SettingsRecipientCard({
  avatar,
  name,
  status,
  isSelected,
  actions,
  'data-testid': testId,
  dataAttributes
}: SettingsRecipientCardProps): ReactElement {
  return (
    <Box
      component="li"
      sx={RECIPIENT_SX}
      data-selected={isSelected}
      data-testid={testId}
      {...dataAttributes}
    >
      {avatar}
      <Box component="span" sx={RECIPIENT_NAME_SX}>
        <span>{name}</span>
        <Box component="span" sx={RECIPIENT_STATUS_SX}>
          {status}
        </Box>
      </Box>
      {actions}
    </Box>
  )
}

const HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  width: 597,
  maxWidth: '100%',
  pt: 4,
  pb: 2
} as const

const HEADER_BUTTON_SX = {
  gap: 1,
  px: 1,
  py: '4px',
  borderRadius: '8px',
  typography: 'subtitle2',
  color: 'text.primary',
  '&[data-tone="danger"]': { color: 'error.main', ml: 'auto' },
  '&:hover': { bgcolor: 'action.hover' }
} as const

export interface SettingsListHeaderProps {
  children: ReactNode
}

/** Above a list of cards: "Select all", how many are selected, "Remove" */
export function SettingsListHeader({
  children
}: SettingsListHeaderProps): ReactElement {
  return <Box sx={HEADER_SX}>{children}</Box>
}

export interface SettingsHeaderButtonProps {
  label: string
  /** Before the label, e.g. the cross leaving the selection */
  icon?: ReactNode
  /** `danger`: red, at the end of the header */
  tone?: 'default' | 'danger'
  onClick: () => void
  'data-testid'?: string
}

/** A text button of `SettingsListHeader` */
export function SettingsHeaderButton({
  label,
  icon,
  tone = 'default',
  onClick,
  'data-testid': testId
}: SettingsHeaderButtonProps): ReactElement {
  return (
    <ButtonBase
      onClick={onClick}
      data-tone={tone}
      sx={HEADER_BUTTON_SX}
      data-testid={testId}
    >
      {icon}
      {label}
    </ButtonBase>
  )
}
