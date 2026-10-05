/**
 * "Important" is carried by headers, as tmail-flutter writes and reads it
 * (`MailPriorityHeader`, `PresentationEmail.isMarkAsImportant`): no keyword.
 */
export const X_PRIORITY_HEADER = 'header:X-Priority:asText'
export const IMPORTANCE_HEADER = 'header:Importance:asText'
export const PRIORITY_HEADER = 'header:Priority:asText'

/** The headers saying an email is important, read with the lists */
export const PRIORITY_HEADERS = [
  X_PRIORITY_HEADER,
  IMPORTANCE_HEADER,
  PRIORITY_HEADER
] as const

export type PriorityHeader = (typeof PRIORITY_HEADERS)[number]

/** An email with its priority headers, null when absent */
export type PriorityHeaders = Partial<Record<PriorityHeader, string | null>>

/** The values tmail-flutter writes for an important message */
export const IMPORTANT_HEADER_VALUES: Readonly<Record<PriorityHeader, string>> =
  {
    [X_PRIORITY_HEADER]: '1',
    [IMPORTANCE_HEADER]: 'high',
    [PRIORITY_HEADER]: 'urgent'
  }

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * Whether the sender marked the email important: `X-Priority: 1`,
 * `Importance: high` or `Priority: urgent`, as tmail-flutter reads them
 */
export function isMarkedImportant(email: PriorityHeaders): boolean {
  return (
    normalized(email[X_PRIORITY_HEADER]).startsWith('1') ||
    normalized(email[IMPORTANCE_HEADER]) === 'high' ||
    normalized(email[PRIORITY_HEADER]) === 'urgent'
  )
}
