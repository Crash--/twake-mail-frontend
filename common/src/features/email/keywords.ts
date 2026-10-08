/** JMAP system keywords (RFC 8621 §4.1.1) the app reads or sets */
export const SEEN = '$seen'
export const FLAGGED = '$flagged'
export const DRAFT = '$draft'
export const ANSWERED = '$answered'
/** Not in RFC 8621, but registered (RFC 5788) and set by mail clients */
export const FORWARDED = '$forwarded'
/** Set on the emails carrying a calendar invitation */
export const EVENT = 'event'
/** Set by the server's AI on the emails that need an answer or a task */
export const NEEDS_ACTION = 'needs-action'
/** Set once the user unsubscribed from the mailing list of the email */
export const UNSUBSCRIBED = '$unsubscribe'

export type EmailKeyword =
  | typeof SEEN
  | typeof FLAGGED
  | typeof DRAFT
  | typeof ANSWERED
  | typeof FORWARDED
  | typeof NEEDS_ACTION
  | typeof UNSUBSCRIBED

export function hasKeyword(
  email: { keywords: Record<string, true> },
  keyword: EmailKeyword
): boolean {
  return keyword in email.keywords
}
