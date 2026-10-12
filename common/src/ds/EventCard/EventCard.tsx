// Upstream to twake-ui: yes. The event card of the Twake design ("Orange
// Bar", linagora-design-flutter `LinagoraEventCard`): date icon, state
// badge, title, labelled details, answers and actions. Mail shows
// invitations with it; Calendar and Chat could show events the same way.
// twake-mui has no card for it.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

/** The colour of the badge: what happened to the event */
export type EventCardBadgeState =
  'created' | 'updated' | 'accepted' | 'maybe' | 'canceled'

// linagora-design-flutter badge backgrounds; the text (#424244) reads on
// all of them above 9:1
const BADGE_BACKGROUNDS: Record<EventCardBadgeState, string> = {
  created: '#D2E9FF',
  updated: '#D2E9FF',
  accepted: '#B9F6CA',
  maybe: '#FDF3E2',
  canceled: '#FFD2D7'
}

const TEXT = 'rgba(66, 66, 68, 0.9)'
// The same opacities of white in the dark scheme (the badges keep their
// light backgrounds and their dark text)
const DARK_TEXT = 'rgba(255, 255, 255, 0.9)'

const CARD_SX = {
  bgcolor: '#F3F6F9',
  borderRadius: 4,
  p: 3,
  color: TEXT,
  display: 'flex',
  gap: 4,
  [`@media ${SCREEN_QUERIES.mobile}`]: { px: 2, py: 3 }
} as const

const CARD_DARK_SX = {
  bgcolor: 'rgba(255, 255, 255, 0.08)',
  color: DARK_TEXT
} as const

const DATE_ICON_SX = {
  flex: '0 0 auto',
  width: 50,
  height: 50,
  bgcolor: '#FFFFFF',
  borderRadius: '11.765px',
  boxShadow: '0 0.98px 1.471px rgba(0, 0, 0, 0.15)',
  overflow: 'hidden',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  [`@media ${SCREEN_QUERIES.mobile}`]: { display: 'none' }
} as const

const DATE_ICON_DARK_SX = { bgcolor: 'rgba(255, 255, 255, 0.12)' } as const

const DATE_MONTH_SX = {
  // The Twake orange is #F67E35; darkened so its white text reads (4.6:1)
  bgcolor: '#C25414',
  color: '#FFFFFF',
  height: '31.37%',
  fontSize: 9,
  fontWeight: 600,
  lineHeight: '15.7px',
  textTransform: 'uppercase'
} as const

const DATE_DAY_SX = {
  flex: 1,
  fontSize: 27,
  fontWeight: 300,
  lineHeight: '34px',
  color: '#27292D'
} as const

const DATE_DAY_DARK_SX = { color: '#FFFFFF' } as const

const BADGE_SX = {
  alignSelf: 'flex-start',
  px: 1,
  py: 0.25,
  borderRadius: 1,
  fontSize: 14,
  lineHeight: '18.4px',
  letterSpacing: 0.25,
  color: TEXT,
  '& strong': { fontWeight: 600 }
} as const

const TITLE_SX = {
  fontSize: 22,
  fontWeight: 400,
  lineHeight: '25.7px',
  color: TEXT,
  overflowWrap: 'anywhere'
} as const

const TITLE_DARK_SX = { color: DARK_TEXT } as const

const DETAILS_SX = {
  display: 'grid',
  gridTemplateColumns: '67px minmax(0, 1fr)',
  columnGap: 2,
  rowGap: 2,
  m: 0,
  // Long addresses and links wrap instead of widening the page (RGAA 10.11)
  overflowWrap: 'anywhere',
  '& dt': {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: '18.4px',
    letterSpacing: 0.5,
    // #424244 at 64 % in the design: 3.4:1, darkened to 80 % (5.2:1)
    color: 'rgba(66, 66, 68, 0.8)'
  },
  '& dd': { m: 0, fontSize: 14, lineHeight: '18.4px', letterSpacing: 0.25 },
  // On a phone each name sits above its value, a size larger
  [`@media ${SCREEN_QUERIES.mobile}`]: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    rowGap: 1,
    '& dt': { fontSize: 14 },
    '& dd': { fontSize: 16, mb: 1 }
  }
} as const

const DETAILS_DARK_SX = {
  '& dt': { color: 'rgba(255, 255, 255, 0.8)' }
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
 * A calendar event as the Twake design shows it: a date icon, the state
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
      sx={theme => ({
        ...CARD_SX,
        ...theme.applyStyles('dark', CARD_DARK_SX)
      })}
      data-testid={testId}
    >
      {date ? (
        <Box
          sx={theme => ({
            ...DATE_ICON_SX,
            ...theme.applyStyles('dark', DATE_ICON_DARK_SX)
          })}
          aria-hidden="true"
        >
          <Box sx={DATE_MONTH_SX}>{date.month}</Box>
          <Box
            sx={theme => ({
              ...DATE_DAY_SX,
              ...theme.applyStyles('dark', DATE_DAY_DARK_SX)
            })}
          >
            {date.day}
          </Box>
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
              sx={{ ...BADGE_SX, bgcolor: BADGE_BACKGROUNDS[badge.state] }}
              data-testid={badgeTestId}
            >
              {badge.content}
            </Box>
          ) : null}
          <Typography
            component={headingLevel}
            sx={theme => ({
              ...TITLE_SX,
              ...theme.applyStyles('dark', TITLE_DARK_SX)
            })}
          >
            {title}
          </Typography>
        </Box>
        {details.length > 0 ? (
          <Box
            component="dl"
            sx={theme => ({
              ...DETAILS_SX,
              ...theme.applyStyles('dark', DETAILS_DARK_SX)
            })}
          >
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
