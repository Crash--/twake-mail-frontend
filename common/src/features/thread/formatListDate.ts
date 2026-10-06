const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Date of an email in the list, as tmail-flutter shows it
 * (`DateTime.toPattern`): the time today, the weekday yesterday, the day and
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
  return new Intl.DateTimeFormat(lang, options).format(date)
}

/** Full date and time, for the tooltip of the list date and the reading view */
export function formatFullDate(isoDate: string, lang: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(lang, {
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
  return new Intl.DateTimeFormat(lang, {
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}
