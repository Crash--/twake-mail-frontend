import type { MailtoFields } from '@common/features/composer/mailto'

/**
 * The intent of the composer, declared in the manifest of the `mailng` app
 * (`manifest/manifest.webapp`): another app (Twake Chat…) asks for a new
 * message
 */
export const COMPOSE_INTENT = { action: 'CREATE', type: 'io.cozy.mails' }

/**
 * What the composer tells the app that asked for it: sent, or kept as a
 * draft. Closed without a draft (or its draft deleted), the intent is
 * cancelled: the client gets null.
 */
export type ComposeIntentResult =
  { status: 'sent' } | { status: 'draft'; draftId: string }

export function isComposeIntent(action: string, type: string): boolean {
  return (
    action.toUpperCase() === COMPOSE_INTENT.action &&
    type === COMPOSE_INTENT.type
  )
}

function readAddresses(value: unknown): string[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const addresses: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const address = item.trim()
    if (address !== '') addresses.push(address)
  }
  return addresses
}

function readText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? value : undefined
}

/**
 * The new message the client asks for: `{ to, cc, bcc, subject, body }`,
 * every field optional, addresses as arrays of strings, the body as plain
 * text. Null when the data has another shape.
 */
export function parseComposeData(data: unknown): MailtoFields | null {
  if (data === undefined || data === null) {
    return { to: [], cc: [], bcc: [], subject: null, body: null }
  }
  if (typeof data !== 'object' || Array.isArray(data)) return null
  const fields: Record<string, unknown> = { ...data }
  const to = readAddresses(fields.to)
  const cc = readAddresses(fields.cc)
  const bcc = readAddresses(fields.bcc)
  const subject = readText(fields.subject)
  const body = readText(fields.body)
  if (
    to === null ||
    cc === null ||
    bcc === null ||
    subject === undefined ||
    body === undefined
  ) {
    return null
  }
  return { to, cc, bcc, subject, body }
}
