// Upstream to twake-ui: no, the rows of tmail-flutter's list of rules
// (`EmailRulesItemWidget`): light grey cards 72 px high, rounded by 10 px,
// 8 px apart, 32 px in; the name in Regular 14 black, then in a grey pill
// what the row does, and the actions at the end.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const LIST_SX = { listStyle: 'none', m: 0, p: 0, pt: '12px', pb: 2 } as const

const CARD_SX = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 72,
  mt: 1,
  px: 4,
  borderRadius: '10px',
  bgcolor: '#F9FAFB'
} as const

const TITLE_SX = {
  flexShrink: 0,
  maxWidth: '50%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  lineHeight: '20px',
  color: '#000000'
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
  bgcolor: 'rgba(73, 69, 79, 0.08)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  lineHeight: '20px',
  color: '#000000'
} as const

const ACTIONS_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexShrink: 0
} as const

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
