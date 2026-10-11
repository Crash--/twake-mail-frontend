import { createHash, randomBytes } from 'node:crypto'

import { env } from '../support/env'
import { expect, test } from '../support/fixtures'
import { JmapClient } from '../support/jmap'
import { getOidcTokens } from '../support/oidc'

/**
 * Smoke tests of the harness with Dex, without the app: the `oidc` suite (support/suites.ts).
 *
 *   E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh
 *   E2E_SUITE=oidc npx playwright test tests/infra-oidc.spec.ts
 */

test.describe('INFRA OIDC', () => {
  test.beforeAll(async () => {
    const discovery = await fetch(
      `${env.oidcIssuer}/.well-known/openid-configuration`
    ).catch(() => null)
    expect(
      discovery?.ok,
      'needs the oidc profile: E2E_OIDC=1 ./scripts/start.sh, then E2E_SUITE=oidc'
    ).toBe(true)
  })

  test('INFRA-10 a Dex access token opens a JMAP session for its email claim', async () => {
    const tokens = await getOidcTokens('alice@example.com', 'secret')
    const session = await new JmapClient({
      auth: { type: 'bearer', token: tokens.accessToken }
    }).getSession()
    expect(session.username).toBe('alice@example.com')
  })

  test('INFRA-11 tmail-backend rejects a forged bearer token', async () => {
    const client = new JmapClient({
      auth: { type: 'bearer', token: 'not-a-token' }
    })
    await expect(client.getSession()).rejects.toThrow(/401/)
  })

  test('INFRA-12 the SPA flow (authorization code + PKCE, public client) ends in a JMAP session', async ({
    page
  }) => {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const redirectUri = `${env.baseUrl}/callback`
    const authorize = new URL(`${env.oidcIssuer}/auth`)
    authorize.search = new URLSearchParams({
      client_id: 'twake-mail',
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: redirectUri,
      state: 'e2e-state',
      code_challenge: challenge,
      code_challenge_method: 'S256'
    }).toString()

    // The code is read from the redirect itself: the app answering /callback may navigate
    // away (in OIDC mode, back to Dex) before the test reads its URL
    const callback = page.waitForRequest(request =>
      request.url().startsWith(`${redirectUri}?`)
    )
    await page.goto(authorize.toString())
    // Dex login page (its labels are not bound to the inputs: locate by accessible name)
    await page.getByRole('textbox', { name: /email/i }).fill('bob@example.com')
    await page.getByRole('textbox', { name: /password/i }).fill('secret')
    await page.getByRole('button', { name: /login/i }).click()

    const code = new URL((await callback).url()).searchParams.get('code')
    // A static page of the app origin, without the app, to run the exchange from
    await page.goto(`${env.baseUrl}/__e2e/health`)
    expect(code).not.toBeNull()
    // Same origin as the app: what the SPA will do, token exchange and JMAP included
    const username = await page.evaluate(
      async ({ code, verifier, redirectUri }) => {
        const tokenResponse = await fetch('/dex/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: 'twake-mail',
            code,
            code_verifier: verifier,
            redirect_uri: redirectUri
          })
        })
        const tokens: unknown = await tokenResponse.json()
        if (
          typeof tokens !== 'object' ||
          tokens === null ||
          !('access_token' in tokens)
        ) {
          return `no token: ${JSON.stringify(tokens)}`
        }
        const session: unknown = await (
          await fetch('/jmap/session', {
            headers: { Authorization: `Bearer ${String(tokens.access_token)}` }
          })
        ).json()
        return typeof session === 'object' &&
          session !== null &&
          'username' in session
          ? session.username
          : JSON.stringify(session)
      },
      { code: code ?? '', verifier, redirectUri }
    )
    expect(username).toBe('bob@example.com')
  })
})
