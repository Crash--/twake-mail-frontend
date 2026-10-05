import type { CalendarEvent } from 'jmap-client-ts/linagora'

const DAY_MS = 24 * 60 * 60 * 1000

export interface EventTimes {
  start: Date
  end: Date | null
  /** Whole days, without a time (`DTSTART;VALUE=DATE`) */
  isAllDay: boolean
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isUtcMidnight(date: Date): boolean {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0
  )
}

/**
 * When the event takes place: `utcStart` and `utcEnd` (tmail-backend), or
 * the local `start` and `end` read in the time zone of the browser. All day
 * as tmail-flutter tells it: from midnight to midnight UTC, whole days.
 */
export function eventTimes(event: CalendarEvent): EventTimes | null {
  const start = toDate(event.utcStart) ?? toDate(event.start)
  if (start === null) return null
  const end = toDate(event.utcEnd) ?? toDate(event.end)
  const isAllDay =
    end !== null &&
    isUtcMidnight(start) &&
    isUtcMidnight(end) &&
    end.getTime() > start.getTime() &&
    (end.getTime() - start.getTime()) % DAY_MS === 0
  return { start, end, isAllDay }
}

function zoneName(
  date: Date,
  locale: string,
  timeZone: string | undefined
): string | null {
  return (
    new Intl.DateTimeFormat(locale, {
      timeZoneName: 'short',
      ...(timeZone ? { timeZone } : {})
    })
      .formatToParts(date)
      .find(part => part.type === 'timeZoneName')?.value ?? null
  )
}

function isSameDay(
  start: Date,
  end: Date,
  locale: string,
  timeZone: string | undefined
): boolean {
  const day = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    ...(timeZone ? { timeZone } : {})
  })
  return day.format(start) === day.format(end)
}

function hasEnd(times: EventTimes): times is EventTimes & { end: Date } {
  return times.end !== null && times.end.getTime() > times.start.getTime()
}

/**
 * The day of the event, in the time zone of the user (or `timeZone`), the
 * bold part of the "When" row: one date for one day, a range of dates
 * (whole days, the last one included) or of dates and hours (across days).
 */
export function formatEventDate(
  times: EventTimes,
  locale: string,
  timeZone?: string
): string {
  if (times.isAllDay && times.end !== null) {
    const format = new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeZone: 'UTC'
    })
    const lastDay = new Date(times.end.getTime() - DAY_MS)
    return lastDay.getTime() > times.start.getTime()
      ? format.formatRange(times.start, lastDay)
      : format.format(times.start)
  }
  const zone = timeZone ? { timeZone } : {}
  if (hasEnd(times) && !isSameDay(times.start, times.end, locale, timeZone)) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeStyle: 'short',
      ...zone
    }).formatRange(times.start, times.end)
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', ...zone }).format(
    times.start
  )
}

/**
 * The hours of the event and its time zone ("10:00 – 11:00 AM (GMT+2)"),
 * after the date; only the time zone when it spans several days; null for
 * whole days.
 */
export function formatEventTime(
  times: EventTimes,
  locale: string,
  timeZone?: string
): string | null {
  if (times.isAllDay) return null
  const zone = zoneName(times.start, locale, timeZone)
  const suffix = zone ? ` (${zone})` : ''
  if (hasEnd(times) && !isSameDay(times.start, times.end, locale, timeZone)) {
    return zone ?? ''
  }
  const format = new Intl.DateTimeFormat(locale, {
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {})
  })
  const range = hasEnd(times)
    ? format.formatRange(times.start, times.end)
    : format.format(times.start)
  return `${range}${suffix}`
}

/** The month and the day of the start, for the date block of the card */
export function formatDateBlock(
  times: EventTimes,
  locale: string,
  timeZone?: string
): { month: string; day: string } {
  const zone = times.isAllDay ? 'UTC' : timeZone
  const options = zone ? { timeZone: zone } : {}
  return {
    month: new Intl.DateTimeFormat(locale, { month: 'short', ...options })
      .format(times.start)
      .replace(/\.$/, ''),
    day: new Intl.DateTimeFormat(locale, { day: 'numeric', ...options }).format(
      times.start
    )
  }
}
