import type { Session } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

/**
 * "Download all" (`com:linagora:params:downloadAll`): the server zips the
 * attachments of an email. Offered when the account advertises the
 * capability with a non-empty `endpoint` and the email has several
 * attachments, as in tmail-flutter (`isDownloadAllSupported`).
 */
function readEndpoint(capability: unknown): string | null {
  if (typeof capability !== 'object' || capability === null) return null
  const endpoint: unknown = (capability as { endpoint?: unknown }).endpoint
  return typeof endpoint === 'string' && endpoint !== '' ? endpoint : null
}

/** The URL template of the capability, or null when it is not available */
export function getDownloadAllEndpoint(
  session: Session,
  accountId: string
): string | null {
  const id = LINAGORA_CAPABILITIES.downloadAll
  const account = session.accounts[accountId]
  const inAccount = account !== undefined && id in account.accountCapabilities
  if (!(id in session.capabilities) && !inAccount) return null
  return (
    readEndpoint(session.capabilities[id]) ??
    readEndpoint(account?.accountCapabilities[id])
  )
}

export function isDownloadAllAvailable(
  session: Session,
  accountId: string,
  attachmentCount: number
): boolean {
  return (
    attachmentCount > 1 && getDownloadAllEndpoint(session, accountId) !== null
  )
}

/** Repeated slashes of the path become one (`normalizePathSlashes`) */
function normalizePathSlashes(url: string): string {
  const schemeEnd = url.indexOf('://')
  const start = schemeEnd === -1 ? 0 : schemeEnd + 3
  return url.slice(0, start) + url.slice(start).replace(/\/{2,}/g, '/')
}

/** The endpoint with `{accountId}`, `{emailId}` and `{name}` filled in */
export function expandDownloadAllUrl(
  endpoint: string,
  values: { accountId: string; emailId: string; name: string }
): string {
  const decoded = (() => {
    try {
      return decodeURI(endpoint)
    } catch {
      return endpoint
    }
  })()
  return normalizePathSlashes(decoded).replace(
    /\{\??(accountId|emailId|name)\}/g,
    (_match, key: keyof typeof values) => encodeURIComponent(values[key])
  )
}

/** Local file header, empty archive and spanned archive signatures */
const ZIP_SIGNATURES: readonly (readonly number[])[] = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08]
]

/**
 * Whether the bytes start like a zip archive: a proxy that does not route
 * the endpoint answers the app's `index.html` with a 200
 */
export function isZipArchive(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 4))
  return ZIP_SIGNATURES.some(
    signature =>
      head.length === signature.length &&
      signature.every((byte, index) => head[index] === byte)
  )
}

/**
 * The name of the archive, without `.zip` (the `name` of the URL):
 * tmail-flutter's `TwakeMail-<date>`, with a date safe in a file name
 */
export function downloadAllBaseName(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-')
  return `TwakeMail-${stamp}`
}
