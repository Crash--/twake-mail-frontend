import { request, type APIRequestContext } from '@playwright/test'

import { env } from './env'

/** Client of dex/config.yaml allowed to use the password grant */
const HARNESS_CLIENT_ID = 'e2e-harness'
const HARNESS_CLIENT_SECRET = 'e2e-harness-secret'

/**
 * Requests to Dex from the test runner. Dex is served over HTTPS with the self-signed
 * certificate of scripts/start.sh, which the browser accepts through `ignoreHTTPSErrors`
 * (playwright.config.ts) and Node's fetch would refuse.
 */
async function withDex<T>(
  use: (dex: APIRequestContext) => Promise<T>
): Promise<T> {
  const dex = await request.newContext({ ignoreHTTPSErrors: true })
  try {
    return await use(dex)
  } finally {
    await dex.dispose()
  }
}

/** Whether Dex answers its discovery document */
export async function isDexReachable(): Promise<boolean> {
  return withDex(async dex => {
    const response = await dex
      .get(`${env.oidcIssuer}/.well-known/openid-configuration`)
      .catch(() => null)
    return response?.ok() ?? false
  })
}

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
  const body: unknown = await withDex(async dex => {
    const response = await dex.post(`${env.oidcIssuer}/token`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${HARNESS_CLIENT_ID}:${HARNESS_CLIENT_SECRET}`).toString('base64')}`
      },
      form: {
        grant_type: 'password',
        username: email,
        password,
        scope: 'openid email profile'
      }
    })
    if (!response.ok()) {
      throw new Error(
        `Dex password grant for ${email} failed: ${response.status()} ${await response.text()}`
      )
    }
    return (await response.json()) as unknown
  })
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
