import type { LinagoraEcosystem } from '@common/features/ecosystem/ecosystem'

import {
  buildWorkplacePaywallUrl,
  isValidPaywallUrl,
  normalizeWorkplaceFqdn,
  resolveQualifiedUrl,
  toSafePaywallUrl
} from './paywallUrl'
import {
  isAlreadyHighestSubscription,
  isPremiumAvailable,
  type SaasCapability
} from './saasCapability'

/**
 * Whether the call to action to upgrade the storage exists, and where it
 * leads (tmail-flutter `premiumCtaProvider`)
 */

export type PremiumCtaUnavailableReason =
  | 'highestSubscription'
  | 'premiumNotAvailable'
  | 'notInsideWorkplace'
  | 'ecosystemUnavailable'
  | 'paywallNotConfigured'
  | 'invalidDestination'

export type PremiumCtaState =
  | { status: 'loading' }
  | { status: 'unavailable'; reason: PremiumCtaUnavailableReason }
  | { status: 'available'; url: string }

/** The ecosystem document of the server, asked only when it is needed */
export type EcosystemState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'available'; ecosystem: LinagoraEcosystem }

export interface PremiumCtaInput {
  capability: SaasCapability | null
  /** The app runs inside Twake Workplace */
  isInsideWorkplace: boolean
  /**
   * The Workplace of the user from the sources that need no request, the
   * claim of the SSO first (`normalizeWorkplaceFqdn`); null without one
   */
  workplaceFqdn: string | null
  ecosystem: EcosystemState
  /** The mailbox owner, who fills the placeholders of the template */
  owner: { email: string; domainName: string | null }
}

const UNAVAILABLE = (reason: PremiumCtaUnavailableReason): PremiumCtaState => ({
  status: 'unavailable',
  reason
})

/** Whether the capability and the context allow a call to action at all */
export function isPremiumCtaPossible(
  capability: SaasCapability | null,
  isInsideWorkplace: boolean
): boolean {
  return (
    !isAlreadyHighestSubscription(capability) &&
    isPremiumAvailable(capability) &&
    isInsideWorkplace
  )
}

/**
 * Whether the paywall can be built without the ecosystem document: when it
 * cannot, the document is fetched (its Workplace fallback or its template)
 */
export function hasLocalPaywallUrl(workplaceFqdn: string | null): boolean {
  return isValidPaywallUrl(buildWorkplacePaywallUrl(workplaceFqdn))
}

function resolveEcosystemFqdn(
  ecosystem: EcosystemState,
  ownerEmail: string
): string | null {
  if (ecosystem.status !== 'available') return null
  const template = ecosystem.ecosystem.workplaceFqdnFallbackTemplate
  if (template === null) return null
  return normalizeWorkplaceFqdn(
    resolveQualifiedUrl(template, { ownerEmail })?.trim()
  )
}

export function resolvePremiumCta({
  capability,
  isInsideWorkplace,
  workplaceFqdn,
  ecosystem,
  owner
}: PremiumCtaInput): PremiumCtaState {
  if (isAlreadyHighestSubscription(capability)) {
    return UNAVAILABLE('highestSubscription')
  }
  if (!isPremiumAvailable(capability)) {
    return UNAVAILABLE('premiumNotAvailable')
  }
  if (!isInsideWorkplace) return UNAVAILABLE('notInsideWorkplace')

  // The highest-priority source that has a value wins: the claim, then the
  // configuration, then the ecosystem
  const fqdn = workplaceFqdn ?? resolveEcosystemFqdn(ecosystem, owner.email)
  const workplaceUrl = toSafePaywallUrl(buildWorkplacePaywallUrl(fqdn))
  if (workplaceUrl !== null) return { status: 'available', url: workplaceUrl }

  if (ecosystem.status === 'loading') return { status: 'loading' }
  if (ecosystem.status === 'unavailable') {
    return UNAVAILABLE('ecosystemUnavailable')
  }
  const template = ecosystem.ecosystem.paywallUrlTemplate
  if (template === null) return UNAVAILABLE('paywallNotConfigured')
  const resolved = toSafePaywallUrl(
    resolveQualifiedUrl(template, {
      ownerEmail: owner.email,
      domainName: owner.domainName
    })
  )
  return resolved === null
    ? UNAVAILABLE('invalidDestination')
    : { status: 'available', url: resolved }
}
