// Upstream to twake-ui: yes. The event card of the Twake design ("Orange
// Bar", linagora-design-flutter `LinagoraEventCard`): date icon, state
// badge, title, labelled details, answers and actions. Mail shows
// invitations with it; Calendar and Chat could show events the same way.
// twake-mui has no card for it.
import { alpha, Box, radius, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

/** The colour of the badge: what happened to the event */
export type EventCardBadgeState =
  'created' | 'updated' | 'accepted' | 'maybe' | 'canceled'

const BADGE_COLORS: Record<
  EventCardBadgeState,
  'info' | 'success' | 'warning' | 'error'
> = {
  created: 'info',
  updated: 'info',
  accepted: 'success',
  maybe: 'warning',
  canceled: 'error'
}

const CARD_SX = {
  bgcolor: 'background.default',
  borderRadius: radius.lg,
  p: 3,
  color: 'text.primary',
  display: 'flex',
  gap: 4,
  [`@media ${SCREEN_QUERIES.mobile}`]: { px: 2, py: 3 }
} as const

const DATE_ICON_SX = {
  flex: '0 0 auto',
  width: 50,
  height: 50,
  bgcolor: 'background.paper',
  borderRadius: radius.md,
  boxShadow: 1,
  overflow: 'hidden',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  [`@media ${SCREEN_QUERIES.mobile}`]: { display: 'none' }
} as const

const DATE_MONTH_SX = {
  bgcolor: 'warning.main',
  color: 'warning.contrastText',
  height: '31.37%',
  typography: 'overline',
  textTransform: 'uppercase'
} as const

const DATE_DAY_SX = {
  flex: 1,
  typography: 'h3',
  color: 'text.primary'
} as const

const BADGE_SX = {
  alignSelf: 'flex-start',
  px: 1,
  py: 0.25,
  borderRadius: radius.sm,
  typography: 'body2',
  color: 'text.primary',
  '& strong': { fontWeight: 600 }
} as const

const TITLE_SX = { overflowWrap: 'anywhere' } as const

const DETAILS_SX = {
  display: 'grid',
  gridTemplateColumns: '67px minmax(0, 1fr)',
  columnGap: 2,
  rowGap: 2,
  m: 0,
  // Long addresses and links wrap instead of widening the page (RGAA 10.11)
  overflowWrap: 'anywhere',
  '& dt': { typography: 'caption', color: 'text.secondary' },
  '& dd': { m: 0, typography: 'body2' },
  // On a phone each name sits above its value, a size larger
  [`@media ${SCREEN_QUERIES.mobile}`]: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    rowGap: 1,
    '& dt': { typography: 'body2' },
    '& dd': { typography: 'body1', mb: 1 }
  }
} as const

const ACTIONS_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 2,
  rowGap: 1,
  '& > [data-event-card-trailing]': { ml: 'auto' },
  [`@media ${SCREEN_QUERIES.mobile}`]: {
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    '& > [data-event-card-trailing]': { ml: 0 }
  }
} as const

export interface EventCardDetail {
  label: string
  content: ReactNode
  'data-testid'?: string
}

export interface EventCardProps {
  /** The heading of the card: the title of the event */
  title: string
  /** Accessible name of the card, e.g. "Event: <title>" */
  label: string
  headingLevel?: 'h2' | 'h3'
  /** Who did what, its actor in bold (`<strong>`), coloured by state */
  badge?: { state: EventCardBadgeState; content: ReactNode } | null
  /** Month and day of the start, null when the event has no date */
  date: { month: string; day: string } | null
  /** Rows of the details list (when, where, who…) */
  details: readonly EventCardDetail[]
  /** Between the details and the actions, e.g. "You are not invited" */
  status?: ReactNode
  /** The answers and actions */
  actions?: ReactNode
  /** An action at the end of the row (centred under them on a phone) */
  trailing?: ReactNode
  'data-testid'?: string
  badgeTestId?: string
}

/**
 * A calendar event: a date icon, the state
 * badge, the title as a heading, a description list of labelled details,
 * then the answers. A `region` named by `label`.
 */
export function EventCard({
  title,
  label,
  headingLevel = 'h2',
  badge,
  date,
  details,
  status,
  actions,
  trailing,
  'data-testid': testId,
  badgeTestId
}: EventCardProps): ReactElement {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={CARD_SX}
      data-testid={testId}
    >
      {date ? (
        <Box sx={DATE_ICON_SX} aria-hidden="true">
          <Box sx={DATE_MONTH_SX}>{date.month}</Box>
          <Box sx={DATE_DAY_SX}>{date.day}</Box>
        </Box>
      ) : null}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {badge ? (
            <Box
              sx={theme => ({
                ...BADGE_SX,
                bgcolor: alpha(
                  theme.palette[BADGE_COLORS[badge.state]].main,
                  0.16
                )
              })}
              data-testid={badgeTestId}
            >
              {badge.content}
            </Box>
          ) : null}
          <Typography variant="h4" component={headingLevel} sx={TITLE_SX}>
            {title}
          </Typography>
        </Box>
        {details.length > 0 ? (
          <Box component="dl" sx={DETAILS_SX}>
            {details.map(detail => (
              <Box
                key={detail.label}
                sx={{ display: 'contents' }}
                data-testid={detail['data-testid']}
              >
                <dt>{detail.label}</dt>
                <dd>{detail.content}</dd>
              </Box>
            ))}
          </Box>
        ) : null}
        {status ?? null}
        {actions || trailing ? (
          <Box sx={ACTIONS_SX}>
            {actions ?? null}
            {trailing ? (
              <Box data-event-card-trailing="">{trailing}</Box>
            ) : null}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
