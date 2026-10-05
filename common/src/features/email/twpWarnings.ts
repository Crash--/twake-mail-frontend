import type { TranslationKey } from '@common/i18n/useI18n'

/**
 * The warnings the backend puts on an email with `X-TWP-Message` headers
 * (contract of tmail-flutter#4639): one header per warning,
 *
 *     X-TWP-Message: level:warn code:virus Text sent by the server
 *
 * `level:` and `code:` are optional leading tokens, in any order; the rest
 * is the server's text, shown when the code is unknown.
 */

/** Asked in `Email/get`: every `X-TWP-Message` header, in message order */
export const TWP_MESSAGE_HEADER = 'header:X-TWP-Message:asText:all'

export type TwpWarningLevel = 'info' | 'warn' | 'error'

export interface TwpWarning {
  level: TwpWarningLevel
  code: string | null
  /** The text of the server, plain text only */
  text: string
  /** Position among the `X-TWP-Message` headers, from 0: its keyword */
  index: number
}

/** A server text is cut here, with an ellipsis (it is not ours to trust) */
export const TWP_TEXT_MAX_LENGTH = 500

const LEVEL_TOKEN = 'level:'
const CODE_TOKEN = 'code:'
const DISMISSED_PREFIX = 'twp-warning-dismissed-'

/** Codes with a localized text, as in tmail-flutter `TwpWarningCodeResolver` */
const CODE_TEXTS = {
  'suspicious-sender': 'email.twpWarning.codes.suspiciousSender',
  virus: 'email.twpWarning.codes.virus',
  'virus-removed': 'email.twpWarning.codes.virusRemoved'
} as const satisfies Record<string, TranslationKey>

function parseLevel(value: string | null): TwpWarningLevel {
  switch (value?.trim().toLowerCase()) {
    case 'warn':
      return 'warn'
    case 'error':
      return 'error'
    default:
      return 'info'
  }
}

// eslint-disable-next-line no-control-regex -- control characters are dropped
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g

function capText(text: string): string {
  const clean = text.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ')
  const characters = Array.from(clean.trim())
  return characters.length > TWP_TEXT_MAX_LENGTH
    ? `${characters.slice(0, TWP_TEXT_MAX_LENGTH).join('')}…`
    : characters.join('')
}

/**
 * Parses the value of one header. Tolerant: a missing or unknown level is
 * `info`, an empty code is none, tokens are read case-insensitively and
 * only before the first word of the text.
 */
export function parseTwpWarning(raw: string, index: number): TwpWarning {
  let level: string | null = null
  let code: string | null = null
  const rest: string[] = []
  let isLeading = true
  for (const token of raw.trim().split(/\s+/)) {
    const lower = token.toLowerCase()
    if (isLeading && lower.startsWith(LEVEL_TOKEN)) {
      level = token.slice(LEVEL_TOKEN.length)
    } else if (isLeading && lower.startsWith(CODE_TOKEN)) {
      code = token.slice(CODE_TOKEN.length)
    } else {
      isLeading = false
      rest.push(token)
    }
  }
  const trimmedCode = code?.trim() ?? ''
  return {
    level: parseLevel(level),
    code: trimmedCode === '' ? null : trimmedCode,
    text: capText(rest.join(' ')),
    index
  }
}

/**
 * The warnings of an email, from the values of `header:X-TWP-Message:asText:all`
 * (null or absent: none). The index is the position among the headers, kept
 * when a warning is dismissed.
 */
export function parseTwpWarnings(
  values: readonly string[] | null | undefined
): TwpWarning[] {
  return (values ?? []).map((value, index) => parseTwpWarning(value, index))
}

/** The localized text of a known code, null for any other */
export function twpWarningCodeText(code: string | null): TranslationKey | null {
  if (code === null) return null
  const key = code.toLowerCase()
  return Object.hasOwn(CODE_TEXTS, key)
    ? CODE_TEXTS[key as keyof typeof CODE_TEXTS]
    : null
}

/** The keyword that keeps the warning at `index` dismissed */
export function twpDismissKeyword(index: number): string {
  return `${DISMISSED_PREFIX}${index}`
}

export function isTwpWarningDismissed(
  email: { keywords: Record<string, true> },
  warning: Pick<TwpWarning, 'index'>
): boolean {
  return twpDismissKeyword(warning.index) in email.keywords
}

/**
 * The one rule behind the "Not spam" action of a banner (the header contract
 * does not define it): an error-level warning on an email that is in Spam.
 */
export function offersNotSpam(
  warning: Pick<TwpWarning, 'level'>,
  isInSpam: boolean
): boolean {
  return warning.level === 'error' && isInSpam
}

/** Whether the email carries an error-level warning (the avatar badge) */
export function hasDangerWarning(warnings: readonly TwpWarning[]): boolean {
  return warnings.some(warning => warning.level === 'error')
}
