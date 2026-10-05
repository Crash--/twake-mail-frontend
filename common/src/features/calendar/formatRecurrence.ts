import type { CalendarEventRecurrenceRule } from 'jmap-client-ts/linagora'

import type { I18nApi, TranslationKey } from '@common/i18n/useI18n'

const FREQUENCY_KEYS: Record<string, TranslationKey> = {
  daily: 'calendar.recurrence.daily',
  weekly: 'calendar.recurrence.weekly',
  monthly: 'calendar.recurrence.monthly',
  yearly: 'calendar.recurrence.yearly'
}

/** Monday 1 January 2024, to name the days of the week */
const MONDAY = Date.UTC(2024, 0, 1)
const DAY_INDEX: Record<string, number> = {
  mo: 0,
  tu: 1,
  we: 2,
  th: 3,
  fr: 4,
  sa: 5,
  su: 6
}

function dayName(day: string, locale: string): string | null {
  // `byDay` may carry a position (`1mo`, `-1fr`): only the day is named
  const code = day.trim().toLowerCase().slice(-2)
  const index = DAY_INDEX[code]
  if (index === undefined) return null
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    timeZone: 'UTC'
  }).format(new Date(MONDAY + index * 24 * 60 * 60 * 1000))
}

function formatUntil(until: string, locale: string): string | null {
  // RFC 5545 `UNTIL` (`20261231T235959Z`) or an ISO date-time
  const compact = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(
    until.trim()
  )
  const date = compact
    ? new Date(
        Date.UTC(
          Number(compact[1]),
          Number(compact[2]) - 1,
          Number(compact[3]),
          Number(compact[4] ?? 0),
          Number(compact[5] ?? 0),
          Number(compact[6] ?? 0)
        )
      )
    : new Date(until)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)
}

/**
 * A recurrence rule in words: "Every 2 weeks, on Monday and Thursday,
 * 5 times". Only what a reader needs: frequency, interval, days, end. A
 * rule the card cannot word (hourly…) gives null.
 */
export function formatRecurrence(
  rule: CalendarEventRecurrenceRule,
  locale: string,
  t: I18nApi['t']
): string | null {
  const key = FREQUENCY_KEYS[rule.frequency.toLowerCase()]
  if (key === undefined) return null
  const parts = [t(key, { smart_count: Math.max(rule.interval ?? 1, 1) })]
  const days = (rule.byDay ?? [])
    .map(day => dayName(day, locale))
    .filter((day): day is string => day !== null)
  if (days.length > 0) {
    parts.push(
      t('calendar.recurrence.onDays', {
        days: new Intl.ListFormat(locale, { type: 'conjunction' }).format(days)
      })
    )
  }
  if (typeof rule.count === 'number' && rule.count > 0) {
    parts.push(t('calendar.recurrence.count', { smart_count: rule.count }))
  } else if (rule.until) {
    const until = formatUntil(rule.until, locale)
    if (until !== null) {
      parts.push(t('calendar.recurrence.until', { date: until }))
    }
  }
  return parts.join(', ')
}
