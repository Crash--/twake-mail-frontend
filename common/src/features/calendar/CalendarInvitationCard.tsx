import { useQuery } from '@tanstack/react-query'
import type { EmailBodyPart } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import { useMemo, type ReactElement } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { prefixSubject } from '@common/features/composer/quote'
import { makeIsSelf } from '@common/features/composer/replyRecipients'
import { useIdentities } from '@common/features/identities/useIdentities'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { findCalendarBlobIds } from './calendarBlobs'
import { attendeeAddresses } from './calendarEvent'
import { CalendarEventCard } from './CalendarEventCard'
import { calendarEventUrl } from './calendarUrl'
import {
  calendarInvitationQueryOptions,
  type CalendarInvitation
} from './queries'
import { useCalendarReply } from './useCalendarReply'

interface Address {
  email: string
}

export interface CalendarInvitationData {
  invitation: CalendarInvitation | null
  blobIds: readonly string[]
}

/**
 * The invitation of an email holding a calendar event (a `.ics`
 * attachment or a `text/calendar` part), when the server reads calendar
 * events (`com:linagora:params:calendar:event`). Null while it loads, and
 * when the server cannot read the file: the email shows as any other.
 */
export function useCalendarInvitation(
  attachments: readonly EmailBodyPart[]
): CalendarInvitationData {
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const blobIds = useMemo(() => findCalendarBlobIds(attachments), [attachments])
  const isSupported =
    LINAGORA_CAPABILITIES.calendarEvent in session.capabilities
  const query = useQuery({
    ...calendarInvitationQueryOptions(client, accountId, blobIds),
    enabled: isSupported && blobIds.length > 0
  })
  return { invitation: query.data ?? null, blobIds }
}

export interface CalendarInvitationCardProps {
  invitation: CalendarInvitation
  blobIds: readonly string[]
  from: readonly Address[] | null | undefined
  replyTo: readonly Address[] | null | undefined
}

/** The event card of an invitation, wired to the replies and the composer */
export function CalendarInvitationCard({
  invitation,
  blobIds,
  from,
  replyTo
}: CalendarInvitationCardProps): ReactElement {
  const { t } = useI18n()
  const config = useAppConfig()
  const { session } = useJmapSession()
  const { data: identities = [] } = useIdentities()
  const { openComposer } = useComposer()
  const { pending, answer } = useCalendarReply(invitation, blobIds)
  const isSelf = useMemo(
    () =>
      makeIsSelf([
        session.username,
        ...identities.map(identity => identity.email)
      ]),
    [session.username, identities]
  )
  const senders = [...(from ?? []), ...(replyTo ?? [])].map(
    address => address.email
  )
  const calendarUrl = calendarEventUrl(invitation.event.uid ?? '', {
    calendarSpaUrl: config?.calendarSpaUrl ?? null,
    workplaceFqdnFallback: config?.workplaceFqdnFallback ?? null,
    username: session.username
  })

  const handleAnswer = (next: Parameters<typeof answer>[0]): void => {
    void answer(next)
  }

  // tmail-flutter: everyone but the user in To, "Re: <title>", no text
  const handleMailToAttendees = (): void => {
    openComposer({
      mailto: {
        to: attendeeAddresses(invitation.event, isSelf),
        cc: [],
        bcc: [],
        subject: prefixSubject(
          invitation.event.title ?? '',
          'Re:',
          t('composer.prefix.reply')
        ),
        body: null
      }
    })
  }

  return (
    <CalendarEventCard
      invitation={invitation}
      senders={senders}
      isSelf={isSelf}
      calendarUrl={calendarUrl}
      pending={pending}
      onAnswer={handleAnswer}
      onMailToAttendees={handleMailToAttendees}
    />
  )
}
