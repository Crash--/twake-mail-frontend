import { resolveUriTemplate } from '@linagora/twake-utils'

import {
  intentRequest,
  readIntent,
  safeUrl,
  type DriveIntent
} from './driveIntent'

type FetchFunction = typeof fetch

export interface DriveUrlContext {
  username: string
  workplaceFqdn: string | null
  workplaceFqdnFallback: string | null
}

/**
 * The address of the Drive (cozy-stack) of the user from `TDRIVE_INTENT_URL`
 * (`{localpart}`, `{workplaceFqdn}`…), without its trailing slash; null when
 * it does not resolve to an https URL (http on a local machine).
 */
export function resolveDriveUrl(
  template: string | null,
  { username, workplaceFqdn, workplaceFqdnFallback }: DriveUrlContext
): string | null {
  if (template === null) return null
  const resolved = resolveUriTemplate(template, {
    localpart: username.split('@')[0] ?? '',
    ...(workplaceFqdn ? { workplaceFqdn } : {}),
    ...(workplaceFqdnFallback ? { workplaceFqdnFallback } : {})
  })
  if (/[{}]/.test(resolved)) return null
  return safeUrl(resolved)?.replace(/\/+$/, '') ?? null
}

export type DriveError = 'token' | 'intent' | 'network'

export type DriveResult<T> =
  { ok: true; value: T } | { ok: false; error: DriveError }

async function postJson(
  fetchFunction: FetchFunction,
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: unknown } | null> {
  try {
    const response = await fetchFunction(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body),
      credentials: 'omit'
    })
    const json: unknown = await response.json().catch(() => null)
    return { status: response.status, json }
  } catch {
    return null
  }
}

/**
 * Trades the OIDC ID token of the user for a token of the Drive
 * (`POST /auth/token_exchange`, `exchange_type: app`), as Twake Calendar
 * and tmail-flutter do. The token stays in memory, never logged.
 */
export async function exchangeDriveToken(
  driveUrl: string,
  idToken: string,
  fetchFunction: FetchFunction = fetch
): Promise<DriveResult<string>> {
  const response = await postJson(
    fetchFunction,
    `${driveUrl}/auth/token_exchange`,
    { id_token: idToken, exchange_type: 'app' }
  )
  if (response === null) return { ok: false, error: 'network' }
  const json = response.json
  const token =
    typeof json === 'object' && json !== null && 'access_token' in json
      ? json.access_token
      : null
  return response.status < 300 && typeof token === 'string' && token !== ''
    ? { ok: true, value: token }
    : { ok: false, error: 'token' }
}

/** Creates the intent of the picker (`POST /intents`) */
export async function createDriveIntent(
  driveUrl: string,
  accessToken: string,
  data: Record<string, unknown>,
  fetchFunction: FetchFunction = fetch
): Promise<DriveResult<DriveIntent>> {
  const response = await postJson(
    fetchFunction,
    `${driveUrl}/intents?force_session_id=true`,
    intentRequest(data),
    { Authorization: `Bearer ${accessToken}` }
  )
  if (response === null) return { ok: false, error: 'network' }
  const intent = response.status < 300 ? readIntent(response.json) : null
  return intent === null
    ? { ok: false, error: 'intent' }
    : { ok: true, value: intent }
}
