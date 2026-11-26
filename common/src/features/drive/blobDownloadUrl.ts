import type { JmapClient, Session } from '@linagora/jmap-client-ts'
import { LINAGORA_CAPABILITIES } from '@linagora/jmap-client-ts/linagora'

/**
 * Unauthenticated blob access
 * (`com:linagora:params:jmap:unauthenticated:blob:access`): the server
 * gives a short-lived token for one blob, so that another server (the stack
 * of Twake Drive) downloads it without the credentials of the user. The
 * URL holds the token: never log it.
 */
function readEndpoint(capability: unknown): string | null {
  if (typeof capability !== 'object' || capability === null) return null
  const endpoint: unknown = (capability as { endpoint?: unknown }).endpoint
  return typeof endpoint === 'string' && endpoint !== '' ? endpoint : null
}

/** The URL template of the capability, or null when it is not available */
export function getBlobAccessEndpoint(
  session: Session,
  accountId: string
): string | null {
  const id = LINAGORA_CAPABILITIES.unauthenticatedBlobAccess
  return (
    readEndpoint(session.capabilities[id]) ??
    readEndpoint(session.accounts[accountId]?.accountCapabilities[id])
  )
}

/** The endpoint with `{accountId}`, `{blobId}` and `{token}` filled in */
export function expandBlobAccessUrl(
  endpoint: string,
  values: { accountId: string; blobId: string; token: string }
): string {
  const decoded = (() => {
    try {
      return decodeURI(endpoint)
    } catch {
      return endpoint
    }
  })()
  return decoded.replace(
    /\{(accountId|blobId|token)\}/g,
    (_match, key: keyof typeof values) => encodeURIComponent(values[key])
  )
}

/**
 * A URL that downloads the blob without authentication for a few minutes,
 * null when the server refuses. A new token for a blob ends the previous one.
 */
export async function fetchBlobDownloadUrl(
  client: JmapClient,
  endpoint: string,
  accountId: string,
  blobId: string
): Promise<string | null> {
  const response = await client.call('UnauthenticatedBlobAccess/set', {
    accountId,
    create: { [blobId]: {} }
  })
  const token = response.created?.[blobId]?.token
  if (typeof token !== 'string' || token === '') return null
  return expandBlobAccessUrl(endpoint, { accountId, blobId, token })
}
