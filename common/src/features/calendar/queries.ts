import { queryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'
import type {
  CalendarEvent,
  CalendarEventAttendanceStatus
} from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

import { readRecurrenceId, type RecurrenceId } from './recurrenceId'

/** The event of an email and how the user answered it */
export interface CalendarInvitation {
  /** The blob the event was read from, the one the replies refer to */
  blobId: string
  event: CalendarEvent
  /** Null when the server could not tell (no CalDAV, error) */
  attendance: CalendarEventAttendanceStatus | null
  /** False when the user has another event at that time */
  isFree: boolean
  /** The occurrence of a recurring event it overrides, null for a whole event */
  recurrenceId: RecurrenceId | null
}

export type CalendarInvitationKey = readonly [
  'calendar',
  string,
  'invitation',
  ...string[]
]

export const calendarKeys = {
  all: (accountId: string): readonly ['calendar', string] => [
    'calendar',
    accountId
  ],
  invitation: (
    accountId: string,
    blobIds: readonly string[]
  ): CalendarInvitationKey => ['calendar', accountId, 'invitation', ...blobIds]
}

/**
 * The occurrence an event overrides: `recurrenceId` when the server gives
 * it, else the `RECURRENCE-ID` of the blob (tmail-backend leaves it out of
 * `CalendarEvent/parse`). A recurring event (with rules) is a whole series;
 * null when the blob cannot be read.
 */
async function recurrenceIdOf(
  client: JmapClient,
  accountId: string,
  blobId: string,
  event: CalendarEvent,
  signal: AbortSignal
): Promise<RecurrenceId | null> {
  if (event.recurrenceId) {
    return { value: event.recurrenceId, timeZone: null }
  }
  if ((event.recurrenceRules ?? []).length > 0) return null
  try {
    const blob = await client.download({ accountId, blobId }, { signal })
    return readRecurrenceId(await blob.text())
  } catch (error: unknown) {
    if (signal.aborted) throw error
    console.warn('[calendar] Cannot read the recurrence id', error)
    return null
  }
}

/**
 * The event of the calendar blobs of an email (`CalendarEvent/parse`) and
 * the answer of the user (`CalendarEventAttendance/get`), in one request,
 * as tmail-flutter asks them. The first event of the first blob is the one
 * shown; null when no blob holds an event. The answer is optional: without
 * CalDAV (tmail-backend memory image) the server fails it.
 */
export function calendarInvitationQueryOptions(
  client: JmapClient,
  accountId: string,
  blobIds: readonly string[]
): QueryOptionsFor<CalendarInvitation | null, CalendarInvitationKey> {
  return queryOptions({
    queryKey: calendarKeys.invitation(accountId, blobIds),
    queryFn: async ({ signal }): Promise<CalendarInvitation | null> => {
      const [parsed, attendance] = await client.requestSettled(
        builder => [
          builder.call('CalendarEvent/parse', {
            accountId,
            blobIds: [...blobIds]
          }),
          builder.call('CalendarEventAttendance/get', {
            accountId,
            blobIds: [...blobIds]
          })
        ],
        { signal }
      )
      if (!parsed.ok) throw parsed.error
      const found = blobIds
        .map(blobId => ({
          blobId,
          event: parsed.value.parsed?.[blobId]?.[0] ?? null
        }))
        .find(
          (entry): entry is { blobId: string; event: CalendarEvent } =>
            entry.event !== null
        )
      if (found === undefined) return null
      const record = attendance.ok
        ? (attendance.value.list.find(item => item.blobId === found.blobId) ??
          null)
        : null
      return {
        blobId: found.blobId,
        event: found.event,
        attendance: record?.eventAttendanceStatus ?? null,
        isFree: record?.isFree ?? true,
        recurrenceId: await recurrenceIdOf(
          client,
          accountId,
          found.blobId,
          found.event,
          signal
        )
      }
    },
    staleTime: Infinity
  })
}
