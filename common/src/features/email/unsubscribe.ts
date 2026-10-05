import {
  parseMailto,
  type MailtoFields
} from '@common/features/composer/mailto'

import { UNSUBSCRIBED, hasKeyword } from './keywords'

/**
 * How to leave a mailing list, from the `List-Unsubscribe` header (RFC
 * 2369), as tmail-flutter picks it: a web link first, else a `mailto:` one.
 * Only `http(s):` and `mailto:` links count: anything else (`javascript:`,
 * `data:`…) is ignored.
 */
export type UnsubscribeMethod =
  { kind: 'web'; url: string } | { kind: 'mailto'; mailto: MailtoFields }

function toWebUrl(link: string): string | null {
  try {
    const url = new URL(link.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : null
  } catch {
    return null
  }
}

/** The way to unsubscribe the links of the header give, null for none */
export function pickUnsubscribeMethod(
  links: readonly string[] | null | undefined
): UnsubscribeMethod | null {
  if (!links) return null
  for (const link of links) {
    const url = toWebUrl(link)
    if (url !== null) return { kind: 'web', url }
  }
  for (const link of links) {
    const mailto = parseMailto(link)
    if (mailto !== null && mailto.to.length > 0)
      return { kind: 'mailto', mailto }
  }
  return null
}

/** Whether the user already unsubscribed (the `$unsubscribe` keyword) */
export function isUnsubscribed(email: {
  keywords: Record<string, true>
}): boolean {
  return hasKeyword(email, UNSUBSCRIBED)
}
