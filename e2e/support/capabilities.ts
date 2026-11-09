import type { Page } from '@playwright/test'

type Capabilities = Record<string, unknown>

/**
 * Sets (a value) or removes (`null`) capabilities in the JMAP session the
 * app reads from /.well-known/jmap, which redirects to /jmap/session, so that
 * a spec holds whatever the stack offers
 */
export async function stubCapabilities(
  page: Page,
  capabilities: Capabilities
): Promise<void> {
  await page.route('**/{jmap/session,.well-known/jmap}', async route => {
    const response = await route.fetch()
    const session = (await response.json()) as {
      capabilities: Capabilities
      accounts: Record<string, { accountCapabilities: Capabilities }>
    }
    for (const [uri, value] of Object.entries(capabilities)) {
      if (value === null) {
        delete session.capabilities[uri]
      } else {
        session.capabilities[uri] = value
      }
      for (const account of Object.values(session.accounts)) {
        if (value === null) {
          delete account.accountCapabilities[uri]
        } else {
          account.accountCapabilities[uri] = value
        }
      }
    }
    await route.fulfill({ response, json: session })
  })
}
