import { Box, Button, Typography } from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { EmailAddressCard } from '@common/features/email/EmailAddressCard'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import type { CalendarPerson, ParticipationStatus } from './calendarEvent'

/**
 * Up to this many people the list is whole; past it, the first
 * `COLLAPSED_PEOPLE` until "See all attendees" (linagora-design-flutter
 * defaults)
 */
export const COLLAPSE_THRESHOLD = 6
export const COLLAPSED_PEOPLE = 5

const STATUS_KEYS: Record<ParticipationStatus, TranslationKey> = {
  needsAction: 'calendar.participation.needsAction',
  accepted: 'calendar.participation.accepted',
  declined: 'calendar.participation.declined',
  tentative: 'calendar.participation.tentative',
  delegated: 'calendar.participation.delegated'
}

export interface CalendarPeopleProps {
  people: readonly CalendarPerson[]
}

/**
 * The organizer and the attendees of an event, each with the answer the
 * event file gives (Twake Calendar shows them, tmail-flutter does not); a
 * long list shows its first people until "See all attendees". Each opens
 * the card of its address, as tmail-flutter.
 */
export function CalendarPeople({ people }: CalendarPeopleProps): ReactElement {
  const { t } = useI18n()
  const listId = useId()
  const [isExpanded, setIsExpanded] = useState(false)
  const isCollapsible = people.length > COLLAPSE_THRESHOLD
  const shown =
    isCollapsible && !isExpanded ? people.slice(0, COLLAPSED_PEOPLE) : people

  const handleToggle = (): void => {
    setIsExpanded(expanded => !expanded)
  }

  return (
    <>
      <Box
        component="ul"
        id={listId}
        className="u-m-0 u-p-0"
        data-testid="calendar-event-people"
      >
        {shown.map(person => (
          <Typography
            key={`${person.email}|${person.name ?? ''}`}
            component="li"
            variant="inherit"
            className="u-breakword u-db"
            data-testid="calendar-event-person"
          >
            {/* As tmail-flutter: the person opens the card of the address
                (copy, write, a rule) */}
            {person.email === '' ? (
              <span className="u-fw-bold">{person.name}</span>
            ) : (
              <EmailAddressCard
                address={{ name: person.name, email: person.email }}
                isInline
              >
                <span className="u-fw-bold">{person.name ?? person.email}</span>
                {person.name ? (
                  <SecondaryText component="span">{` <${person.email}>`}</SecondaryText>
                ) : null}
              </EmailAddressCard>
            )}
            {person.isOrganizer ? (
              <SecondaryText component="span">
                {` - ${t('calendar.organizer')}`}
              </SecondaryText>
            ) : null}
            {person.status && !person.isOrganizer ? (
              <SecondaryText component="span">
                {` · ${t(STATUS_KEYS[person.status])}`}
              </SecondaryText>
            ) : null}
          </Typography>
        ))}
      </Box>
      {isCollapsible ? (
        <Button
          variant="text"
          color="inherit"
          size="small"
          aria-expanded={isExpanded}
          aria-controls={listId}
          onClick={handleToggle}
          data-testid="calendar-event-see-all-attendees"
        >
          {isExpanded
            ? t('calendar.hideAttendees')
            : `${t('calendar.seeAllAttendees')} (${people.length})`}
        </Button>
      ) : null}
    </>
  )
}
