// Upstream to twake-ui: no, the rows of tmail-flutter's lists of the
// settings: the rules (`EmailRulesItemWidget`), light grey cards 72 px
// high, rounded by 10 px, 8 px apart, 32 px in, the name in Regular 14
// black, then in a grey pill what the row does, and the actions at the
// end; the recipients of the forwarding, narrower cards with an avatar,
// under a header selecting them.
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const LIST_SX = { listStyle: 'none', m: 0, p: 0, pt: '12px', pb: 2 } as const

const CARD_SX = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 72,
  mt: 1,
  px: 4,
  borderRadius: '10px',
  bgcolor: TMAIL.fillF9
} as const

const TITLE_SX = {
  flexShrink: 0,
  maxWidth: '50%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  lineHeight: '20px',
  color: TMAIL.textBlack
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
  bgcolor: TMAIL.fillTonal,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  lineHeight: '20px',
  color: TMAIL.textBlack
} as const

const ACTIONS_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexShrink: 0
} as const

const RECIPIENT_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: 597,
  maxWidth: '100%',
  minHeight: 72,
  mt: '4px',
  px: 2,
  borderRadius: '10px',
  bgcolor: TMAIL.fillF9,
  '&[data-selected="true"]': { bgcolor: TMAIL.blueSelected }
} as const

const RECIPIENT_NAME_SX = {
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: 14,
  lineHeight: '20px',
  color: TMAIL.textBlack,
  '& > span:first-of-type': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }
} as const

const RECIPIENT_STATUS_SX = {
  display: 'flex',
  flexShrink: 0,
  color: TMAIL.primary
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
 * A recipient of tmail-flutter's forwarding (`EmailForwardItemWidget`): a
 * light grey card at most 597 px wide, its avatar, the address and a blue
 * status icon, the delete button at the end; light blue once selected
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
  fontSize: 14,
  fontWeight: 600,
  lineHeight: '20px',
  letterSpacing: '0.25px',
  color: TMAIL.textGrey,
  '&[data-tone="danger"]': { color: TMAIL.error, ml: 'auto' },
  '&:hover': { bgcolor: TMAIL.hoverBlack }
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

/** A text button of `SettingsListHeader`, Semi Bold 14 */
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
