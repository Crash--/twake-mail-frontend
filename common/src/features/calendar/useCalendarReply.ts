import { useQueryClient } from '@tanstack/react-query'
import type { SetError } from 'jmap-client-ts'
import {
  LINAGORA_CAPABILITIES,
  type CalendarEventAttendanceStatus,
  type CalendarEventCapability
} from 'jmap-client-ts/linagora'
import { useCallback, useState } from 'react'

import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { replyLanguage, type CalendarReply } from './calendarEvent'
import {
  calendarKeys,
  type CalendarInvitation,
  type CalendarInvitationKey
} from './queries'

/** What the user answers: an invitation, or the counter proposal */
export type CalendarAnswer = CalendarReply | 'acceptCounter'

const ATTENDANCE: Record<CalendarAnswer, CalendarEventAttendanceStatus> = {
  yes: 'accepted',
  maybe: 'tentativelyAccepted',
  no: 'rejected',
  acceptCounter: 'accepted'
}

const SUCCESS: Record<CalendarAnswer, TranslationKey> = {
  yes: 'calendar.replied.yes',
  maybe: 'calendar.replied.maybe',
  no: 'calendar.replied.no',
  acceptCounter: 'calendar.counterAccepted'
}

export interface CalendarReplyApi {
  /** The answer being sent, null when none */
  pending: CalendarAnswer | null
  answer: (answer: CalendarAnswer) => Promise<void>
}

type Outcome = { ok: true } | { ok: false; error: SetError | null }

function outcomeOf(
  blobId: string,
  done: readonly string[] | null | undefined,
  failed: Record<string, SetError> | null | undefined
): Outcome {
  if (failed?.[blobId]) return { ok: false, error: failed[blobId] }
  // tmail-backend lists the blob, or the uid of the event (tmail-flutter
  // only checks that the list is not empty)
  return (done ?? []).length > 0 ? { ok: true } : { ok: false, error: null }
}

/**
 * Answers the invitation of an email: `CalendarEvent/accept`, `maybe`,
 * `reject`, in the language of the UI when the server writes it, or
 * `CalendarEventCounter/accept` for a counter proposal. The answer shows
 * at once on the card; a failure shows a translated message, the server
 * detail going to the console.
 */
export function useCalendarReply(
  invitation: CalendarInvitation,
  blobIds: readonly string[]
): CalendarReplyApi {
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const queryClient = useQueryClient()
  const { notify } = useNotify()
  const { t, lang } = useI18n()
  const [pending, setPending] = useState<CalendarAnswer | null>(null)
  const { blobId } = invitation

  const answer = useCallback(
    async (next: CalendarAnswer): Promise<void> => {
      // SAFETY: the capability object tmail-backend advertises
      const capability = session.capabilities[
        LINAGORA_CAPABILITIES.calendarEvent
      ] as CalendarEventCapability | undefined
      // The server detail goes to the console (and Sentry), the user reads
      // a translated message
      const fail = (error: unknown): void => {
        if (error !== null) {
          console.error('[calendar] Cannot answer the invitation', error)
        }
        notify({ message: t('calendar.replyFailed'), severity: 'error' })
      }
      if (next === 'acceptCounter' && capability?.counterSupport !== true) {
        fail(null)
        return
      }
      setPending(next)
      try {
        const outcome = await sendAnswer(next)
        if (!outcome.ok) {
          fail(outcome.error)
          return
        }
        const key: CalendarInvitationKey = calendarKeys.invitation(
          accountId,
          blobIds
        )
        queryClient.setQueryData<CalendarInvitation | null>(key, current =>
          current ? { ...current, attendance: ATTENDANCE[next] } : current
        )
        notify({ message: t(SUCCESS[next]), severity: 'success' })
      } catch (error: unknown) {
        fail(error)
      } finally {
        setPending(null)
      }

      async function sendAnswer(
        answerToSend: CalendarAnswer
      ): Promise<Outcome> {
        const ids = [blobId]
        if (answerToSend === 'acceptCounter') {
          const response = await client.call('CalendarEventCounter/accept', {
            accountId,
            blobIds: ids
          })
          return outcomeOf(blobId, response.accepted, response.notAccepted)
        }
        const language = replyLanguage(lang, capability?.replySupportedLanguage)
        const args = {
          accountId,
          blobIds: ids,
          ...(language === null ? {} : { language })
        }
        switch (answerToSend) {
          case 'yes': {
            const response = await client.call('CalendarEvent/accept', args)
            return outcomeOf(blobId, response.accepted, response.notAccepted)
          }
          case 'maybe': {
            const response = await client.call('CalendarEvent/maybe', args)
            return outcomeOf(blobId, response.maybe, response.notMaybe)
          }
          case 'no': {
            const response = await client.call('CalendarEvent/reject', args)
            return outcomeOf(blobId, response.rejected, response.notRejected)
          }
        }
      }
    },
    [accountId, blobId, blobIds, client, lang, notify, queryClient, session, t]
  )

  return { pending, answer }
}
