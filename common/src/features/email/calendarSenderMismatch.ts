import { graphemes } from '@/ds/graphemes/graphemes'

/**
 * The addresses behind the `calendar-sender-mismatch` warning: the backend
 * (tmail-backend#3162) puts them in a header of their own,
 *
 *     X-Twake-Calendar-Sender-Mismatch: organizer=<a@example.com>; sender=<b@example.org>
 *
 * `organizer` may be missing.
 */

/** Asked in `Email/get` next to the `X-TWP-Message` headers */
export const CALENDAR_SENDER_MISMATCH_HEADER =
  'header:X-Twake-Calendar-Sender-Mismatch:asText'

export interface CalendarSenderMismatch {
  organizer: string | null
  sender: string | null
}

/** An address is cut here: it comes from the server, not ours to trust */
const ADDRESS_MAX_LENGTH = 320

// eslint-disable-next-line no-control-regex -- control characters are dropped
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g

const PARAMETER = /^\s*(organizer|sender)\s*=(.*)$/i

function cleanAddress(value: string): string | null {
  const address = value
    .replace(CONTROL_CHARACTERS, '')
    .trim()
    .replace(/^<\s*/, '')
    .replace(/\s*>$/, '')
    .trim()
  if (address === '') return null
  const characters = graphemes(address)
  return characters.length > ADDRESS_MAX_LENGTH
    ? `${characters.slice(0, ADDRESS_MAX_LENGTH).join('')}…`
    : address
}

function parseParameter(part: string): [string, string | null] | null {
  const match = PARAMETER.exec(part)
  if (match === null) return null
  const [, name = '', rawAddress = ''] = match
  return [name.toLowerCase(), cleanAddress(rawAddress)]
}

/**
 * Parses the value of the header (null or absent: none). Tolerant: the
 * parameters in any order, case-insensitive names, with or without `<…>`.
 */
export function parseCalendarSenderMismatch(
  value: string | null | undefined
): CalendarSenderMismatch {
  const parameters = (value ?? '')
    .split(';')
    .map(parseParameter)
    .filter(parameter => parameter !== null)
  const find = (name: string): string | null =>
    parameters.find(([key]) => key === name)?.[1] ?? null
  return { organizer: find('organizer'), sender: find('sender') }
}
