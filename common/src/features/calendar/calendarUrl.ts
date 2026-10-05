import { resolveCalendarSpaUrl } from '@linagora/twake-utils'

export interface CalendarUrlOptions {
  /** `CALENDAR_SPA_URL`, a URI template */
  calendarSpaUrl: string | null
  workplaceFqdnFallback: string | null
  /** The address of the user, for `{localpart}` */
  username: string
}

/**
 * The event in Twake Calendar, which opens it at `/events/<uid>` (as
 * tmail-flutter links its `calendarUrlTemplate`); null without
 * `CALENDAR_SPA_URL` or when the result is not an http(s) URL.
 */
export function calendarEventUrl(
  uid: string,
  { calendarSpaUrl, workplaceFqdnFallback, username }: CalendarUrlOptions
): string | null {
  if (!calendarSpaUrl || !uid.trim()) return null
  const base = resolveCalendarSpaUrl(calendarSpaUrl, {
    localpart: username.split('@')[0] ?? '',
    ...(workplaceFqdnFallback ? { workplaceFqdnFallback } : {})
  })
  if (base === null) return null
  try {
    const url = new URL(
      `${base.replace(/\/+$/, '')}/events/${encodeURIComponent(uid.trim())}`
    )
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : null
  } catch {
    return null
  }
}
