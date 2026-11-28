const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const formatters = new Map<string, Intl.DateTimeFormat>()
let formattersOf: typeof Intl.DateTimeFormat | null = null
let timeZone = ''
let timeZoneReadAt = Number.NEGATIVE_INFINITY

// Reading the time zone costs as much as building a formatter
const TIME_ZONE_READ_MS = 1000

/**
 * One formatter per language, time zone and options, kept: building one
 * costs far more than formatting with it, and the list formats several dates
 * per row. The time zone of the device is read again at most every second.
 */
function formatterOf(
  lang: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  // The formatjs polyfill may replace Intl.DateTimeFormat (`loadDateFormats`).
  // The data of a language it gets later does not reach the formatters built
  // before: I18nProvider shows a language only once its data is there.
  if (formattersOf !== Intl.DateTimeFormat) {
    formatters.clear()
    formattersOf = Intl.DateTimeFormat
    timeZoneReadAt = Number.NEGATIVE_INFINITY
  }
  const now = Date.now()
  if (now < timeZoneReadAt || now - timeZoneReadAt >= TIME_ZONE_READ_MS) {
    timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
    timeZoneReadAt = now
  }
  const key = `${lang} ${timeZone} ${JSON.stringify(options)}`
  let formatter = formatters.get(key)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(lang, { ...options, timeZone })
    formatters.set(key, formatter)
  }
  return formatter
}

/**
 * Date of an email in the list, as tmail-flutter shows it
 * (`DateTime.toPattern`): the time today (on the clock of the language, as
 * the reading view and the event card), the weekday yesterday, the day and
 * month this year, the full date before.
 */
export function formatListDate(
  isoDate: string,
  lang: string,
  now: Date = new Date()
): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''

  const dayDifference = Math.round(
    (startOfDay(now) - startOfDay(date)) / DAY_MS
  )
  let options: Intl.DateTimeFormatOptions
  if (dayDifference === 0) {
    options = { hour: 'numeric', minute: '2-digit' }
  } else if (dayDifference === 1) {
    options = { weekday: 'short' }
  } else if (date.getFullYear() === now.getFullYear()) {
    options = { month: 'short', day: 'numeric' }
  } else {
    options = { year: 'numeric', month: 'short', day: 'numeric' }
  }
  return formatterOf(lang, options).format(date)
}

/** Full date and time, for the tooltip of the list date and the reading view */
export function formatFullDate(isoDate: string, lang: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return formatterOf(lang, {
    dateStyle: 'full',
    timeStyle: 'short'
  }).format(date)
}

/**
 * Date and time of the header of an open email, as the mocks write it
 * ("28 Jul, 2:20 am"): the year is added when it is not the current one
 */
export function formatHeaderDate(
  isoDate: string,
  lang: string,
  now: Date = new Date()
): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return formatterOf(lang, {
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}
