import type { EmailRecoveryActionCreate } from 'jmap-client-ts/linagora'

import type { TranslationKey } from '@common/i18n/useI18n'

/** tmail-backend's default horizon when the capability does not say */
const DEFAULT_HORIZON_DAYS = 15

/**
 * The days of the restoration horizon of the vault capability
 * (`restorationHorizon`, "15 days", "1 day 12 hours"), rounded up
 */
export function horizonDays(horizon: string | null | undefined): number {
  if (!horizon) return DEFAULT_HORIZON_DAYS
  const days = Number(/(\d+)\s*day/i.exec(horizon)?.[1] ?? 0)
  const hours = Number(/(\d+)\s*hour/i.exec(horizon)?.[1] ?? 0)
  const total = days + (hours > 0 ? 1 : 0)
  return total > 0 ? total : DEFAULT_HORIZON_DAYS
}

export type RecoveryRange =
  | 'allTime'
  | 'last7Days'
  | 'last15Days'
  | 'last30Days'
  | 'last6Months'
  | 'last1Year'

const RANGE_DAYS: Record<RecoveryRange, number | null> = {
  allTime: null,
  last7Days: 7,
  last15Days: 15,
  last30Days: 30,
  last6Months: 183,
  last1Year: 365
}

export const RANGE_LABELS: Record<RecoveryRange, TranslationKey> = {
  allTime: 'recovery.ranges.allTime',
  last7Days: 'recovery.ranges.last7Days',
  last15Days: 'recovery.ranges.last15Days',
  last30Days: 'recovery.ranges.last30Days',
  last6Months: 'recovery.ranges.last6Months',
  last1Year: 'recovery.ranges.last1Year'
}

/** The deletion periods within the horizon, as tmail-flutter offers them */
export function deletionRanges(horizon: number): RecoveryRange[] {
  const fitting = (
    [
      'last7Days',
      'last15Days',
      'last30Days',
      'last6Months',
      'last1Year'
    ] as const
  ).filter(range => (RANGE_DAYS[range] ?? 0) <= horizon)
  return fitting.length > 0 ? fitting : ['last7Days']
}

/** The reception periods (tmail-flutter: all time by default) */
export const RECEPTION_RANGES: readonly RecoveryRange[] = [
  'allTime',
  'last7Days',
  'last30Days',
  'last6Months',
  'last1Year'
]

/** The UTC date `range` starts at, before `now`; null for all time */
export function rangeStart(range: RecoveryRange, now: Date): string | null {
  const days = RANGE_DAYS[range]
  if (days === null) return null
  return new Date(now.getTime() - days * 86_400_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
}

export interface RecoveryForm {
  deletion: RecoveryRange
  reception: RecoveryRange
  subject: string
  sender: string | null
  recipients: string[]
  hasAttachment: boolean
}

/** What `EmailRecoveryAction/set` creates: only the criteria given */
export function recoveryCriteria(
  form: RecoveryForm,
  now: Date
): EmailRecoveryActionCreate {
  const criteria: EmailRecoveryActionCreate = {}
  const deletedAfter = rangeStart(form.deletion, now)
  const receivedAfter = rangeStart(form.reception, now)
  if (deletedAfter !== null) criteria.deletedAfter = deletedAfter
  if (receivedAfter !== null) criteria.receivedAfter = receivedAfter
  if (form.subject.trim() !== '') criteria.subject = form.subject.trim()
  if (form.sender !== null) criteria.sender = form.sender
  if (form.recipients.length > 0) criteria.recipients = form.recipients
  if (form.hasAttachment) criteria.hasAttachment = true
  return criteria
}
