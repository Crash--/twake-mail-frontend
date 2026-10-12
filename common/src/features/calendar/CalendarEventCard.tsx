import { Icon } from '@linagora/twake-icons'
import {
  Alert,
  Box,
  IconButton,
  Link,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useId, useMemo, type ReactElement } from 'react'

import {
  EventCard,
  type EventCardBadgeState,
  type EventCardDetail
} from '@/ds/EventCard/EventCard'
import {
  EventAnswerButton,
  EventTextAction
} from '@/ds/EventCard/EventCardButtons'
import {
  CalendarToday,
  Copy,
  WarningCircle
} from '@/ds/FlutterIcons/FlutterIcons'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import type { IsSelf } from '@common/features/composer/replyRecipients'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import {
  actionsOf,
  bannerOf,
  descriptionText,
  isOrganizer,
  isParticipant,
  methodOf,
  peopleOf,
  replyOfAttendance,
  textOrNull,
  videoConferenceLinks,
  type CalendarBannerKind,
  type CalendarReply
} from './calendarEvent'
import { CalendarPeople } from './CalendarPeople'
import {
  eventTimes,
  formatDateBlock,
  formatEventDate,
  formatEventTime
} from './formatEventTime'
import { formatRecurrence } from './formatRecurrence'
import { LinkifiedText } from './LinkifiedText'
import type { CalendarInvitation } from './queries'
import type { CalendarAnswer } from './useCalendarReply'

const BANNER_KEYS: Record<CalendarBannerKind, TranslationKey> = {
  invited: 'calendar.banner.invited',
  updated: 'calendar.banner.updated',
  canceled: 'calendar.banner.canceled',
  accepted: 'calendar.banner.accepted',
  tentative: 'calendar.banner.tentative',
  declined: 'calendar.banner.declined',
  counter: 'calendar.banner.counter',
  counterDeclined: 'calendar.banner.counterDeclined'
}

/** The colour of the badge, as tmail-flutter's mapper picks it */
const BANNER_STATES: Record<CalendarBannerKind, EventCardBadgeState> = {
  invited: 'created',
  updated: 'updated',
  canceled: 'canceled',
  accepted: 'accepted',
  tentative: 'maybe',
  declined: 'canceled',
  counter: 'updated',
  counterDeclined: 'canceled'
}

const REPLY_KEYS: Record<CalendarReply, TranslationKey> = {
  yes: 'calendar.reply.yes',
  maybe: 'calendar.reply.maybe',
  no: 'calendar.reply.no'
}

/** The `data-testid` of the answers */
export const CALENDAR_REPLY_TEST_IDS: Record<CalendarAnswer, string> = {
  yes: 'calendar-event-reply-yes',
  maybe: 'calendar-event-reply-maybe',
  no: 'calendar-event-reply-no',
  acceptCounter: 'calendar-event-reply-yes'
}

export interface CalendarEventCardProps {
  invitation: CalendarInvitation
  /** The From and Reply-To addresses of the email */
  senders: readonly string[]
  isSelf: IsSelf
  /** The event in Twake Calendar, null when not configured */
  calendarUrl: string | null
  /** The answer being sent */
  pending: CalendarAnswer | null
  onAnswer: (answer: CalendarAnswer) => void
  onMailToAttendees: () => void
  /** Time zone of the dates, the browser's by default (tests) */
  timeZone?: string
}

/**
 * The calendar event of an email, as tmail-flutter's "Orange Bar" card:
 * who did what, when (in the time zone of the user) and how it repeats,
 * where, the meeting link (shown and copied, not joined: tmail-flutter
 * #4622), the organizer and the attendees; Yes / Maybe / No for an
 * invitation (Yes only for a counter proposal), "Mail to attendees" and the
 * event in Twake Calendar. The description follows the card, as text.
 */
export function CalendarEventCard({
  invitation,
  senders,
  isSelf,
  calendarUrl,
  pending,
  onAnswer,
  onMailToAttendees,
  timeZone
}: CalendarEventCardProps): ReactElement {
  const { t, lang } = useI18n()
  const { notify } = useNotify()
  const attendingId = useId()
  const { event } = invitation
  const method = methodOf(event)
  const title = textOrNull(event.title) ?? t('calendar.untitled')
  const times = useMemo(() => eventTimes(event), [event])
  const banner = bannerOf(event, senders, t('calendar.anAttendee'))
  const actions = actionsOf(event, isSelf)
  const isInvited = isParticipant(event, isSelf) || isOrganizer(event, isSelf)
  const current = replyOfAttendance(invitation.attendance)
  const people = useMemo(() => peopleOf(event), [event])
  const links = videoConferenceLinks(event)
  const description = descriptionText(event.description)
  const location = event.location?.trim() ?? ''
  const recurrence = (event.recurrenceRules ?? [])
    .map(rule => formatRecurrence(rule, lang, t))
    .filter((text): text is string => text !== null)
  const showsBusy =
    !invitation.isFree && method !== 'REPLY' && method !== 'CANCEL'

  const handleCopy = (link: string): void => {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        notify({ message: t('calendar.linkCopied'), severity: 'success' })
      })
      .catch((error: unknown) => {
        console.warn('[calendar] Cannot copy the link', error)
      })
  }

  const details: EventCardDetail[] = []
  if (times !== null) {
    const time = formatEventTime(times, lang, timeZone)
    details.push({
      label: t('calendar.when'),
      'data-testid': 'calendar-event-when',
      content: (
        <>
          <span className="u-fw-bold">
            {formatEventDate(times, lang, timeZone)}
          </span>
          {time === null ? ` · ${t('calendar.allDay')}` : ` · ${time}`}
          {recurrence.length > 0 ? (
            <SecondaryText
              component="span"
              className="u-db"
              data-testid="calendar-event-recurrence"
            >
              {recurrence.join(' ; ')}
            </SecondaryText>
          ) : null}
          {showsBusy ? (
            <Box
              component="span"
              className="u-flex u-flex-items-center u-mt-half"
              data-testid="calendar-event-busy"
            >
              <Icon
                icon={WarningCircle}
                size={16}
                aria-hidden="true"
                className="u-mr-half"
              />
              {t('calendar.busy')}
            </Box>
          ) : null}
        </>
      )
    })
  }
  if (location !== '') {
    details.push({
      label: t('calendar.where'),
      'data-testid': 'calendar-event-where',
      content: <LinkifiedText text={location} />
    })
  }
  if (links.length > 0) {
    details.push({
      label: t('calendar.videoConference'),
      'data-testid': 'calendar-event-video',
      content: (
        <Box component="ul" className="u-m-0 u-p-0">
          {links.map(link => (
            <Box
              component="li"
              key={link}
              className="u-flex u-flex-items-center"
            >
              <Link
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                className="u-breakword"
                data-testid="calendar-event-video-link"
              >
                {link}
              </Link>
              <Tooltip title={t('calendar.copyLink')}>
                <IconButton
                  size="small"
                  aria-label={t('calendar.copyLink')}
                  onClick={() => {
                    handleCopy(link)
                  }}
                  className="u-ml-half"
                  data-testid="calendar-event-copy-link"
                >
                  <Icon icon={Copy} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )
    })
  }
  if (people.length > 0) {
    details.push({
      label: t('calendar.who'),
      'data-testid': 'calendar-event-who',
      content: <CalendarPeople people={people} />
    })
  }

  const answers: CalendarAnswer[] = actions.acceptsCounter
    ? ['acceptCounter']
    : [...actions.replies]

  return (
    <>
      <EventCard
        title={title}
        label={t('calendar.eventLabel', { title })}
        date={times ? formatDateBlock(times, lang, timeZone) : null}
        badge={
          banner
            ? {
                state: BANNER_STATES[banner.kind],
                content: (
                  <>
                    {banner.actor ? (
                      <strong>{`${banner.actor} `}</strong>
                    ) : null}
                    {t(BANNER_KEYS[banner.kind])}
                  </>
                )
              }
            : null
        }
        badgeTestId="calendar-event-banner"
        details={details}
        status={
          !isInvited && method !== 'CANCEL' ? (
            <Alert severity="error" data-testid="calendar-event-not-invited">
              {t('calendar.notInvited')}
            </Alert>
          ) : null
        }
        actions={
          answers.length > 0 || actions.mailToAttendees ? (
            <>
              {answers.length > 0 ? (
                <Box
                  role="group"
                  aria-labelledby={attendingId}
                  className="u-flex u-flex-wrap u-flex-items-center u-flex-justify-center"
                  data-testid="calendar-event-replies"
                >
                  <Typography
                    id={attendingId}
                    component="span"
                    className="u-mr-1 u-fw-bold"
                  >
                    {t('calendar.attending')}
                  </Typography>
                  {answers.map(answer => {
                    const isCounter = answer === 'acceptCounter'
                    const isCurrent = !isCounter && current === answer
                    return (
                      <Box
                        key={answer}
                        component="span"
                        className="u-mr-half u-mv-half"
                      >
                        <EventAnswerButton
                          isPressed={isCounter ? undefined : isCurrent}
                          disabled={pending !== null && pending !== answer}
                          isBusy={pending === answer}
                          onClick={() => {
                            if (pending === null) onAnswer(answer)
                          }}
                          data-testid={CALENDAR_REPLY_TEST_IDS[answer]}
                        >
                          {t(
                            isCounter
                              ? 'calendar.reply.yes'
                              : REPLY_KEYS[answer]
                          )}
                        </EventAnswerButton>
                      </Box>
                    )
                  })}
                </Box>
              ) : null}
              {actions.mailToAttendees ? (
                <EventTextAction
                  onClick={onMailToAttendees}
                  data-testid="calendar-event-mail-to-attendees"
                >
                  {t('calendar.mailToAttendees')}
                </EventTextAction>
              ) : null}
            </>
          ) : null
        }
        trailing={
          calendarUrl !== null && isInvited ? (
            <EventTextAction
              href={calendarUrl}
              icon={CalendarToday}
              data-testid="calendar-event-open-in-calendar"
            >
              {t('calendar.seeInCalendar')}
            </EventTextAction>
          ) : null
        }
        data-testid="calendar-event-card"
      />
      {description !== '' ? (
        <Box className="u-mt-1" data-testid="calendar-event-description">
          <Typography component="h3" className="u-fw-bold u-mb-half">
            {t('calendar.description')}
          </Typography>
          <Typography className="u-breakword">
            <LinkifiedText text={description} />
          </Typography>
        </Box>
      ) : null}
    </>
  )
}
