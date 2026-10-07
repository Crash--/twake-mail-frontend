import { resolveUriTemplate } from '@linagora/twake-utils'

import {
  isValidFqdn,
  normalizeWorkplaceFqdn
} from '@common/features/paywall/paywallUrl'

export interface PlatformUrlContext {
  /** The address the user signed in with */
  username: string
  /** `workplaceFqdn` claim of the SSO, null without one */
  workplaceFqdn: string | null
  /** `WORKPLACE_FQDN_FALLBACK`, used when the SSO has no workplace */
  workplaceFqdnFallback: string | null
}

/**
 * The origin of the Twake Workplace (cozy-stack) of the user, which the
 * platform top bar talks to: the `workplaceFqdn` claim of the SSO, else
 * `WORKPLACE_FQDN_FALLBACK` (`{localpart}`), in https. Null when neither
 * gives a valid host.
 */
export function resolvePlatformUrl({
  username,
  workplaceFqdn,
  workplaceFqdnFallback
}: PlatformUrlContext): string | null {
  const fqdn = normalizeWorkplaceFqdn(
    resolveUriTemplate('{workplaceFqdn}', {
      localpart: username.split('@')[0] ?? '',
      workplaceFqdn: normalizeWorkplaceFqdn(workplaceFqdn) ?? '',
      workplaceFqdnFallback: workplaceFqdnFallback ?? ''
    })
  )
  if (fqdn === null || /[{}]/.test(fqdn)) return null
  const url = new URL(/^https:\/\//i.test(fqdn) ? fqdn : `https://${fqdn}`)
  return isValidFqdn(url.hostname) ? url.origin : null
}
