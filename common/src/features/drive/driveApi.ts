type FetchFunction = typeof fetch

export type DriveError = 'token' | 'network'

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
