// Upstream to twake-ui: no. The rows of the lists of the settings: the
// rules, cards on `background.default` 72 px high, 8 px apart, the name,
// then in a pill what the row does, and the actions at the end; the
// recipients of the forwarding, rows with an avatar ruled in one outlined
// list, under a header selecting them, and that outlined box empty.
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const LIST_SX = { listStyle: 'none', m: 0, p: 0, pt: '12px', pb: 2 } as const

const CARD_SX = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 72,
  mt: 1,
  px: 4,
  borderRadius: '10px',
  bgcolor: 'background.default'
} as const

const TITLE_SX = {
  flexShrink: 0,
  maxWidth: '50%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  typography: 'body1',
  color: 'text.primary'
} as const

const PILL_ROW_SX = {
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex'
} as const

const PILL_SX = {
  minWidth: 0,
  mx: 3,
  px: '12px',
  py: '4px',
  borderRadius: '16px',
  bgcolor: 'action.hover',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  typography: 'body1',
  color: 'text.primary'
} as const

const ACTIONS_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexShrink: 0
} as const

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

const EMPTY_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  px: 3,
  py: 3,
  textAlign: 'center',
  color: 'text.secondary',
  typography: 'body2'
} as const

const EMPTY_ICON_SX = {
  display: 'flex',
  mb: 2,
  color: 'primary.light'
} as const

const EMPTY_TITLE_SX = {
  m: 0,
  mb: 1,
  typography: 'body1',
  color: 'text.primary'
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

export interface SettingsRecipientEmptyProps {
  /** A 64 px glyph, drawn in `primary.light` */
  icon: ReactNode
  title: string
  text: string
  'data-testid'?: string
}

/** In place of the outlined list while it has no recipient */
export function SettingsRecipientEmpty({
  icon,
  title,
  text,
  'data-testid': testId
}: SettingsRecipientEmptyProps): ReactElement {
  return (
    <Box sx={{ ...OUTLINED_SX, ...EMPTY_SX }} data-testid={testId}>
      <Box component="span" sx={EMPTY_ICON_SX}>
        {icon}
      </Box>
      <Box component="p" sx={EMPTY_TITLE_SX}>
        {title}
      </Box>
      <Box component="p" sx={{ m: 0, maxWidth: 340 }}>
        {text}
      </Box>
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

export interface SettingsCardListProps {
  label: string
  children: ReactNode
  'data-testid'?: string
}

/** The cards of a settings section */
export function SettingsCardList({
  label,
  children,
  'data-testid': testId
}: SettingsCardListProps): ReactElement {
  return (
    <Box component="ul" aria-label={label} sx={LIST_SX} data-testid={testId}>
      {children}
    </Box>
  )
}

export interface SettingsCardProps {
  /** Its name */
  title: ReactNode
  /** What it does, in the grey pill; null for none (phones) */
  pill: ReactNode | null
  /** At the end, e.g. edit and delete */
  actions: ReactNode
  titleTestId?: string
  'data-testid'?: string
  /** `data-*` attributes of the card */
  dataAttributes?: Record<`data-${string}`, string | undefined>
}

/** A card of a settings list */
export function SettingsCard({
  title,
  pill,
  actions,
  titleTestId,
  'data-testid': testId,
  dataAttributes
}: SettingsCardProps): ReactElement {
  return (
    <Box component="li" sx={CARD_SX} data-testid={testId} {...dataAttributes}>
      <Box
        component="span"
        sx={
          pill === null
            ? { ...TITLE_SX, flex: '1 1 auto', maxWidth: 'none' }
            : TITLE_SX
        }
        data-testid={titleTestId}
      >
        {title}
      </Box>
      {pill === null ? null : (
        <Box component="span" sx={PILL_ROW_SX}>
          <Box component="span" sx={PILL_SX}>
            {pill}
          </Box>
        </Box>
      )}
      <Box sx={ACTIONS_SX}>{actions}</Box>
    </Box>
  )
}
