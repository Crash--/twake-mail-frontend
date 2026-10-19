import type { EmailRecoveryActionCreate } from 'jmap-client-ts/linagora'

import type { DayRange } from '@common/features/dateRange/dayRange'
import { formatDay } from '@common/features/search/searchFilter'
import { fromLocalInputs } from '@common/features/vacation/vacation'
import type { TranslationKey } from '@common/i18n/useI18n'

/** tmail-backend's default horizon when the capability does not say */
const DEFAULT_HORIZON_DAYS = 15

const DAY_MS = 86_400_000

/**
 * The days of the restoration horizon of the vault capability
 * (`restorationHorizon`, "15 days", "1 day 12 hours"), rounded up
 */
export function horizonDays(horizon: string | null | undefined): number {
  if (!horizon) return DEFAULT_HORIZON_DAYS
  // (?<!…): a run is tried from its first character only (ReDoS)
  const days = Number(/(?<!\d)(\d+)\s*day/i.exec(horizon)?.[1] ?? 0)
  const hours = Number(/(?<!\d)(\d+)\s*hour/i.exec(horizon)?.[1] ?? 0)
  const total = days + (hours > 0 ? 1 : 0)
  return total > 0 ? total : DEFAULT_HORIZON_DAYS
}

/** The fixed periods (tmail-flutter's `EmailReceiveTimeType`) */
export type RecoveryPreset =
  | 'allTime'
  | 'last7Days'
  | 'last15Days'
  | 'last30Days'
  | 'last6Months'
  | 'last1Year'

/** A choice of the period menus: a fixed period or a custom range */
export type RecoveryRange = RecoveryPreset | 'customRange'

/** A period chosen in the form */
export type RecoveryPeriod =
  { range: RecoveryPreset } | ({ range: 'customRange' } & DayRange)

export const RANGE_LABELS: Record<RecoveryRange, TranslationKey> = {
  allTime: 'recovery.ranges.allTime',
  last7Days: 'recovery.ranges.last7Days',
  last15Days: 'recovery.ranges.last15Days',
  last30Days: 'recovery.ranges.last30Days',
  last6Months: 'recovery.ranges.last6Months',
  last1Year: 'recovery.ranges.last1Year',
  customRange: 'recovery.ranges.customRange'
}

/** `value` moved back by `months` months, on the last day of a shorter month */
function monthsBefore(value: Date, months: number): Date {
  const target = new Date(value.getFullYear(), value.getMonth() - months, 1)
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate()
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(value.getDate(), lastDay),
    value.getHours(),
    value.getMinutes(),
    value.getSeconds(),
    value.getMilliseconds()
  )
}

/**
 * When `range` starts, before `now`; null for all time. As tmail-flutter's
 * `toDateRange`: days back for the days, calendar months for the months
 */
export function presetStart(range: RecoveryPreset, now: Date): Date | null {
  switch (range) {
    case 'allTime':
      return null
    case 'last7Days':
      return new Date(now.getTime() - 7 * DAY_MS)
    case 'last15Days':
      return new Date(now.getTime() - 15 * DAY_MS)
    case 'last30Days':
      return new Date(now.getTime() - 30 * DAY_MS)
    case 'last6Months':
      return monthsBefore(now, 6)
    case 'last1Year':
      return monthsBefore(now, 12)
  }
}

/** The oldest deletion the vault restores, `horizon` days before `now` */
export function horizonStart(horizon: number, now: Date): Date {
  return new Date(now.getTime() - horizon * DAY_MS)
}

/** The first day a custom deletion range can start on */
export function firstDeletionDay(horizon: number, now: Date): string {
  return formatDay(horizonStart(horizon, now))
}

const DELETION_PRESETS = [
  'last7Days',
  'last15Days',
  'last30Days',
  'last6Months',
  'last1Year'
] as const satisfies readonly RecoveryPreset[]

/**
 * The deletion periods, as tmail-flutter offers them: those within the
 * horizon (2 s of slack, so that "Last 15 days" fits a 15 days horizon),
 * then the custom range
 */
export function deletionRanges(horizon: number, now: Date): RecoveryRange[] {
  const oldest = horizonStart(horizon, now).getTime() - 2000
  const fitting: RecoveryRange[] = DELETION_PRESETS.filter(
    range => (presetStart(range, now)?.getTime() ?? 0) >= oldest
  )
  const presets: RecoveryRange[] = fitting.length > 0 ? fitting : ['last7Days']
  return [...presets, 'customRange']
}

/** The reception periods (tmail-flutter: all time by default) */
export const RECEPTION_RANGES: readonly RecoveryRange[] = [
  'allTime',
  'last7Days',
  'last30Days',
  'last6Months',
  'last1Year',
  'customRange'
]

/** The day after `day` (`YYYY-MM-DD`) */
function nextDay(day: string): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return formatDay(new Date(year, month - 1, date + 1))
}

/** JMAP `UTCDate`: no milliseconds */
function toUtcDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * The UTC bounds of a period: after its start, before its end. A custom
 * range runs from the midnight starting its first day to the midnight
 * ending its last one, local time; `oldest`, given, moves a start before it
 * to it (the horizon of the vault)
 */
export function periodBounds(
  period: RecoveryPeriod,
  now: Date,
  oldest: Date | null = null
): { after: string | null; before: string | null } {
  if (period.range !== 'customRange') {
    const start = presetStart(period.range, now)
    return { after: start === null ? null : toUtcDate(start), before: null }
  }
  const after = fromLocalInputs(period.start, '00:00')
  const before = fromLocalInputs(nextDay(period.end), '00:00')
  return {
    after:
      after !== null && oldest !== null && new Date(after) < oldest
        ? toUtcDate(oldest)
        : after,
    before
  }
}

export interface RecoveryForm {
  deletion: RecoveryPeriod
  reception: RecoveryPeriod
  subject: string
  sender: string | null
  recipients: string[]
  hasAttachment: boolean
}

/** What `EmailRecoveryAction/set` creates: only the criteria given */
export function recoveryCriteria(
  form: RecoveryForm,
  now: Date,
  horizon: number
): EmailRecoveryActionCreate {
  const criteria: EmailRecoveryActionCreate = {}
  const deleted = periodBounds(form.deletion, now, horizonStart(horizon, now))
  const received = periodBounds(form.reception, now)
  if (deleted.after !== null) criteria.deletedAfter = deleted.after
  if (deleted.before !== null) criteria.deletedBefore = deleted.before
  if (received.after !== null) criteria.receivedAfter = received.after
  if (received.before !== null) criteria.receivedBefore = received.before
  if (form.subject.trim() !== '') criteria.subject = form.subject.trim()
  if (form.sender !== null) criteria.sender = form.sender
  if (form.recipients.length > 0) criteria.recipients = form.recipients
  if (form.hasAttachment) criteria.hasAttachment = true
  return criteria
}
