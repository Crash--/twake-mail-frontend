/**
 * The `RECURRENCE-ID` of an event (RFC 5545 §3.8.4.4): the original start
 * of the occurrence an overridden VEVENT replaces. Its value as written
 * (`20261103T090000`, `20261103T080000Z`, `20261103`), with its `TZID`.
 */
export interface RecurrenceId {
  value: string
  timeZone: string | null
}

/** When the occurrence was planned to start */
export interface OccurrenceStart {
  date: Date
  /** A date without a time (`VALUE=DATE`), at midnight UTC */
  isAllDay: boolean
}

/** RFC 5545 §3.1: a line starting with a space or a tab continues the previous one */
function unfoldedLines(ics: string): string[] {
  return ics.split(/\r?\n/).reduce<string[]>((lines, line) => {
    const last = lines.length - 1
    if ((line.startsWith(' ') || line.startsWith('\t')) && last >= 0) {
      lines[last] = `${lines[last]}${line.slice(1)}`
    } else {
      lines.push(line)
    }
    return lines
  }, [])
}

function parseProperty(line: string): RecurrenceId {
  const colon = line.indexOf(':')
  const params = line.slice(0, colon).split(';').slice(1)
  const tzid = params
    .find(param => param.toUpperCase().startsWith('TZID='))
    ?.slice('TZID='.length)
    .replace(/^"|"$/g, '')
    .trim()
  return {
    value: line.slice(colon + 1).trim(),
    timeZone: tzid === undefined || tzid === '' ? null : tzid
  }
}

/**
 * The `RECURRENCE-ID` of the first VEVENT of an iCalendar text, the event
 * `CalendarEvent/parse` lists first; null when it has none
 */
export function readRecurrenceId(ics: string): RecurrenceId | null {
  const lines = unfoldedLines(ics)
  const begin = lines.findIndex(
    line => line.trim().toUpperCase() === 'BEGIN:VEVENT'
  )
  if (begin < 0) return null
  const rest = lines.slice(begin + 1)
  const end = rest.findIndex(line => line.trim().toUpperCase() === 'END:VEVENT')
  const line = (end < 0 ? rest : rest.slice(0, end)).find(candidate => {
    const name = candidate.toUpperCase()
    return (
      (name.startsWith('RECURRENCE-ID:') ||
        name.startsWith('RECURRENCE-ID;')) &&
      candidate.includes(':')
    )
  })
  return line === undefined ? null : parseProperty(line)
}

/** The offset of `timeZone` from UTC at `instant`, in milliseconds */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
      .formatToParts(new Date(instant))
      .map(part => [part.type, Number(part.value)])
  )
  const wallClock = Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0
  )
  return wallClock - Math.floor(instant / 1000) * 1000
}

/** The instant a wall clock time of `timeZone` stands for */
function fromWallClock(wallClock: number, timeZone: string): number | null {
  try {
    const guess = wallClock - zoneOffset(wallClock, timeZone)
    return wallClock - zoneOffset(guess, timeZone)
  } catch {
    // an unknown time zone (a custom VTIMEZONE)
    return null
  }
}

/**
 * When the occurrence was planned to start: in UTC (`Z`), in its `TZID`
 * (or `defaultTimeZone`, the time zone of the event), or else in the time
 * zone of the browser (a floating time). Null when unreadable.
 */
export function occurrenceStart(
  recurrenceId: RecurrenceId,
  defaultTimeZone: string | null
): OccurrenceStart | null {
  const match =
    /^(\d{4})-?(\d{2})-?(\d{2})(?:T(\d{2}):?(\d{2}):?(\d{2})?(Z)?)?$/.exec(
      recurrenceId.value
    )
  if (match === null) return null
  const [, year, month, day, hour, minute, second, utc] = match
  const fields = [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
    Number(second ?? 0)
  ] as const
  const wallClock = Date.UTC(...fields)
  if (hour === undefined) {
    return { date: new Date(wallClock), isAllDay: true }
  }
  const timeZone = recurrenceId.timeZone ?? defaultTimeZone
  const instant =
    utc !== undefined
      ? wallClock
      : timeZone !== null
        ? fromWallClock(wallClock, timeZone)
        : new Date(...fields).getTime()
  return instant === null || Number.isNaN(instant)
    ? null
    : { date: new Date(instant), isAllDay: false }
}

/**
 * The original start of the occurrence, as the card tells it: the date
 * alone for a whole day, else the date and the time, in the time zone of
 * the user (or `timeZone`)
 */
export function formatOccurrenceStart(
  start: OccurrenceStart,
  locale: string,
  timeZone?: string
): string {
  if (start.isAllDay) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeZone: 'UTC'
    }).format(start.date)
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {})
  }).format(start.date)
}
