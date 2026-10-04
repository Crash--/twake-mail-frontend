import { env } from './env'
import { WebAdminClient } from './webadmin'

/**
 * Fails fast, with a hint, when the backend is not running: a broken stack would otherwise
 * show up as dozens of unrelated timeouts.
 */
async function probe(
  what: string,
  check: () => Promise<boolean>
): Promise<string | null> {
  try {
    return (await check()) ? null : `${what}: unexpected answer`
  } catch (error: unknown) {
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? ` (${error.cause.message})`
        : ''
    return `${what}: ${error instanceof Error ? error.message : String(error)}${cause}`
  }
}

// Playwright loads globalSetup through its default export: the one exception to named exports
export default async function globalSetup(): Promise<void> {
  const webadmin = new WebAdminClient()
  const problems = (
    await Promise.all([
      probe(`WebAdmin ${env.webadminUrl}/healthcheck`, () =>
        webadmin.healthcheck()
      ),
      probe(`domain ${env.domain}`, () => webadmin.domainExists(env.domain)),
      // 401: JMAP is up and asks for credentials
      probe(
        `JMAP ${env.jmapUrl}/jmap/session`,
        async () => (await fetch(`${env.jmapUrl}/jmap/session`)).status === 401
      ),
      probe(
        `app ${env.baseUrl}/`,
        async () => (await fetch(`${env.baseUrl}/`)).ok
      ),
      probe(
        `JMAP through the app origin ${env.baseUrl}/jmap/session`,
        async () => (await fetch(`${env.baseUrl}/jmap/session`)).status === 401
      ),
      env.oidc
        ? probe(
            `Dex ${env.oidcIssuer}`,
            async () =>
              (
                await fetch(
                  `${env.oidcIssuer}/.well-known/openid-configuration`
                )
              ).ok
          )
        : Promise.resolve(null)
    ])
  ).filter((problem): problem is string => problem !== null)

  if (problems.length > 0) {
    throw new Error(
      `The e2e stack is not reachable:\n  - ${problems.join('\n  - ')}\n` +
        'Start it with `./scripts/start.sh` (E2E_OIDC=1 for the oidc profile), or set E2E_BASE_URL / E2E_JMAP_URL / E2E_WEBADMIN_URL.'
    )
  }
}
