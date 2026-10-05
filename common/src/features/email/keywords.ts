/** JMAP system keywords (RFC 8621 §4.1.1) the app reads or sets */
export const SEEN = '$seen'
export const FLAGGED = '$flagged'
export const DRAFT = '$draft'
/** Set by the server's AI on the emails that need an answer or a task */
export const NEEDS_ACTION = 'needs-action'

export type EmailKeyword =
  typeof SEEN | typeof FLAGGED | typeof DRAFT | typeof NEEDS_ACTION

export function hasKeyword(
  email: { keywords: Record<string, true> },
  keyword: EmailKeyword
): boolean {
  return keyword in email.keywords
}
