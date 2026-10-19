// The days of `DateRangePicker`: `YYYY-MM-DD` strings (local days), so that
// a day compares as text and never moves with the time zone.

/** A local day, `YYYY-MM-DD` */
export type Day = string

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** The local day of `date` */
export function dayOf(date: Date): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Midnight (local time) of `day` */
export function dateOf(day: Day): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/** `day` moved by `days` days */
export function addDays(day: Day, days: number): Day {
  const date = dateOf(day)
  return dayOf(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
  )
}

/** `day` moved by `months` months, on the last day of a shorter month */
export function addMonths(day: Day, months: number): Day {
  const date = dateOf(day)
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + months + 1,
    0
  ).getDate()
  return dayOf(
    new Date(
      date.getFullYear(),
      date.getMonth() + months,
      Math.min(date.getDate(), lastDay)
    )
  )
}

/** The first day of the month of `day` */
export function monthOf(day: Day): Day {
  return `${day.slice(0, 7)}-01`
}

/** 0 for a Monday … 6 for a Sunday (the week starts on Monday, as tmail-flutter) */
export function weekdayOf(day: Day): number {
  return (dateOf(day).getDay() + 6) % 7
}

/**
 * The weeks of the month starting on `month`, Monday first: null for the
 * cells before its first day and after its last one
 */
export function monthWeeks(month: Day): (Day | null)[][] {
  const first = monthOf(month)
  const length = dateOf(addMonths(first, 1)).getTime()
  const cells: (Day | null)[] = Array.from(
    { length: weekdayOf(first) },
    () => null
  )
  for (let day = first; dateOf(day).getTime() < length; day = addDays(day, 1)) {
    cells.push(day)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7)
  )
}

/** `day` written `dd/mm/yyyy`, as tmail-flutter's date fields */
export function formatDayText(day: Day): string {
  const [year, month, date] = day.split('-')
  return `${date}/${month}/${year}`
}

/** The day of a `dd/mm/yyyy` text, null when it is not a real day */
export function parseDayText(text: string): Day | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (match === null) return null
  const [, date = '', month = '', year = ''] = match
  const day = `${year}-${month}-${date}`
  return dayOf(dateOf(day)) === day ? day : null
}

/**
 * What a date field shows while typed: the digits, a slash put after the
 * day and the month (tmail-flutter's `DateInputFormatter`)
 */
export function maskDayText(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
