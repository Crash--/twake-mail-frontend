import {
  queryOptions,
  useQuery,
  type UseQueryResult
} from '@tanstack/react-query'
import {
  CAPABILITIES,
  type JmapClient,
  type VacationResponse
} from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import { isSingletonUpdated } from '@common/jmap/isSingletonUpdated'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

export type VacationKey = readonly ['vacation', string]

export const vacationKeys = {
  all: (accountId: string): VacationKey => ['vacation', accountId]
}

const NO_VACATION: VacationResponse = {
  id: 'singleton',
  isEnabled: false,
  fromDate: null,
  toDate: null,
  subject: null,
  textBody: null,
  htmlBody: null
}

/** The vacation response of the account (`VacationResponse/get`) */
export function vacationQueryOptions(
  client: JmapClient,
  accountId: string
): QueryOptionsFor<VacationResponse, VacationKey> {
  return queryOptions({
    queryKey: vacationKeys.all(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'VacationResponse/get',
        { accountId, ids: ['singleton'] },
        { signal }
      )
      return { ...NO_VACATION, ...response.list[0] }
    }
  })
}

/** Whether the server sends vacation responses (RFC 8621) */
export function useHasVacation(): boolean {
  const { session } = useJmapSession()
  return CAPABILITIES.vacationResponse in session.capabilities
}

/** The vacation response, when the server has some */
export function useVacation(): UseQueryResult<VacationResponse> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  return useQuery({
    ...vacationQueryOptions(client, accountId),
    enabled: useHasVacation()
  })
}

/** What the user can change of the vacation response */
export type VacationValues = Omit<VacationResponse, 'id'>

/** Saves the vacation response (`VacationResponse/set`); false when refused */
export async function saveVacation(
  client: JmapClient,
  accountId: string,
  values: VacationValues
): Promise<boolean> {
  const response = await client.call('VacationResponse/set', {
    accountId,
    update: { singleton: values }
  })
  return isSingletonUpdated(response)
}

/**
 * Turned off as tmail-flutter does: the dates and subject cleared, the
 * message kept for next time
 */
export function disabledVacation(
  current: Pick<VacationResponse, 'htmlBody'>
): VacationValues {
  return {
    isEnabled: false,
    fromDate: null,
    toDate: null,
    subject: null,
    textBody: null,
    htmlBody: current.htmlBody
  }
}

export type VacationState =
  /** Off, or ended */
  | 'off'
  /** On, its start date to come */
  | 'scheduled'
  /** Replying now */
  | 'active'
  /** On, its end date passed */
  | 'ended'

/** Where a vacation response stands at `now` (tmail-flutter's rules) */
export function vacationState(
  vacation: Pick<VacationResponse, 'isEnabled' | 'fromDate' | 'toDate'>,
  now: Date
): VacationState {
  if (!vacation.isEnabled) return 'off'
  const time = now.getTime()
  if (vacation.toDate !== null && Date.parse(vacation.toDate) < time) {
    return 'ended'
  }
  if (vacation.fromDate !== null && Date.parse(vacation.fromDate) > time) {
    return 'scheduled'
  }
  return 'active'
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** A UTC date as the date and time inputs show it, in local time */
export function toLocalInputs(utc: string | null): {
  date: string
  time: string
} {
  if (utc === null) return { date: '', time: '' }
  const date = new Date(utc)
  if (Number.isNaN(date.getTime())) return { date: '', time: '' }
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}

/**
 * The UTC date of local date and time inputs (`2026-10-05`, `08:30`;
 * midnight without a time), null when the date is missing or invalid
 */
export function fromLocalInputs(date: string, time: string): string | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!day) return null
  const [hours = 0, minutes = 0] = (/^\d{2}:\d{2}$/.test(time) ? time : '00:00')
    .split(':')
    .map(Number)
  const local = new Date(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    hours,
    minutes
  )
  return Number.isNaN(local.getTime())
    ? null
    : local.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
