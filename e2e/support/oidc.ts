import { env } from './env'

/** Client of dex/config.yaml allowed to use the password grant */
const HARNESS_CLIENT_ID = 'e2e-harness'
const HARNESS_CLIENT_SECRET = 'e2e-harness-secret'

export interface OidcTokens {
  accessToken: string
  idToken: string
  expiresIn: number
}

/**
 * Gets tokens from Dex without a browser (resource owner password grant). Only for the
 * `oidc` profile (E2E_OIDC=1) and Dex static accounts: alice@example.com / bob@example.com,
 * password `secret`. The browser login flow itself is what the UI specs exercise.
 */
export async function getOidcTokens(
  email: string,
  password: string
): Promise<OidcTokens> {
  const response = await fetch(`${env.oidcIssuer}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${HARNESS_CLIENT_ID}:${HARNESS_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: email,
      password,
      scope: 'openid email profile'
    })
  })
  if (!response.ok) {
    throw new Error(
      `Dex password grant for ${email} failed: ${response.status} ${await response.text()}`
    )
  }
  const body: unknown = await response.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    !('access_token' in body) ||
    typeof body.access_token !== 'string' ||
    !('id_token' in body) ||
    typeof body.id_token !== 'string'
  ) {
    throw new Error(`Unexpected Dex token response: ${JSON.stringify(body)}`)
  }
  const expiresIn =
    'expires_in' in body && typeof body.expires_in === 'number'
      ? body.expires_in
      : 0
  return { accessToken: body.access_token, idToken: body.id_token, expiresIn }
}
