/** JMAP system keywords (RFC 8621 §4.1.1) the app reads or sets */
export const SEEN = '$seen'
export const FLAGGED = '$flagged'

export type EmailKeyword = typeof SEEN | typeof FLAGGED

export function hasKeyword(
  email: { keywords: Record<string, true> },
  keyword: EmailKeyword
): boolean {
  return keyword in email.keywords
}

/** The keywords with `keyword` set or removed */
export function withKeyword(
  keywords: Record<string, true>,
  keyword: EmailKeyword,
  isSet: boolean
): Record<string, true> {
  if (isSet) return { ...keywords, [keyword]: true }
  const { [keyword]: _removed, ...rest } = keywords
  return rest
}
