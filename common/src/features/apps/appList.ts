import { resolveUriTemplate } from '@linagora/twake-utils'

import type { AppListEntry } from '@common/config/config'

export interface AppTemplateContext {
  /** The address the user signed in with */
  username: string
  /** `workplaceFqdn` claim of the SSO, null without one */
  workplaceFqdn: string | null
  /** `WORKPLACE_FQDN_FALLBACK`, used when the SSO has no workplace */
  workplaceFqdnFallback: string | null
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * The apps of `appList.js` for this user: their `link` and `icon` read as
 * URI templates (`{localpart}`, `{workplaceFqdn}`, `{workplaceFqdn.localpart}`,
 * `{workplaceFqdn.domain}`), as the other Twake apps resolve them. An app
 * whose link is not an http(s) URL once resolved (a template the user has
 * nothing for) is left out.
 */
export function resolveAppList(
  apps: readonly AppListEntry[],
  { username, workplaceFqdn, workplaceFqdnFallback }: AppTemplateContext
): AppListEntry[] {
  const context = {
    localpart: username.split('@')[0] ?? '',
    ...(workplaceFqdn ? { workplaceFqdn } : {}),
    ...(workplaceFqdnFallback ? { workplaceFqdnFallback } : {})
  }
  return apps
    .map(app => ({
      ...app,
      link: resolveUriTemplate(app.link, context),
      icon: resolveUriTemplate(app.icon, context)
    }))
    .filter(app => !/[{}]/.test(app.link) && isHttpUrl(app.link))
}
