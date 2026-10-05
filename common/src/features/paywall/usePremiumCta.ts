import { useQuery } from '@tanstack/react-query'
import { resolveUriTemplate } from '@linagora/twake-utils'
import { useMemo } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import { useAuthState } from '@common/features/auth/AuthProvider'
import { useIsEmbedded } from '@common/features/embedding/embedding'
import { ecosystemQueryOptions } from '@common/features/ecosystem/ecosystem'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { getRootDomain, normalizeWorkplaceFqdn } from './paywallUrl'
import {
  hasLocalPaywallUrl,
  isPremiumCtaPossible,
  resolvePremiumCta,
  type EcosystemState,
  type PremiumCtaState
} from './premiumCta'
import { readSaasCapability } from './saasCapability'

/**
 * Whether the user can upgrade the storage, and the paywall to open: the
 * SaaS capability of the account, the app inside Twake Workplace
 * (`WORKPLACE_EMBEDDING` in an iframe), and a safe paywall URL, from the
 * Workplace of the user or from the ecosystem document of the server. The
 * document is only asked when nothing else gives the URL.
 */
export function usePremiumCta(): PremiumCtaState {
  const { session, accountId } = useJmapSession()
  const config = useAppConfig()
  const auth = useAuthState()
  const isInsideWorkplace = useIsEmbedded()
  const claim = auth.status === 'authenticated' ? auth.user.workplaceFqdn : null
  const username = session.username
  const fallback = config?.workplaceFqdnFallback ?? null
  const ecosystemUrl = config?.ecosystemUrl ?? null

  const capability = useMemo(
    () => readSaasCapability(session, accountId),
    [session, accountId]
  )
  const workplaceFqdn = useMemo(
    () =>
      normalizeWorkplaceFqdn(
        resolveUriTemplate('{workplaceFqdn}', {
          localpart: username.split('@')[0] ?? '',
          workplaceFqdn: normalizeWorkplaceFqdn(claim) ?? '',
          workplaceFqdnFallback: fallback ?? ''
        })
      ),
    [claim, fallback, username]
  )

  const needsEcosystem =
    ecosystemUrl !== null &&
    isPremiumCtaPossible(capability, isInsideWorkplace) &&
    !hasLocalPaywallUrl(workplaceFqdn)
  const query = useQuery({
    ...ecosystemQueryOptions(ecosystemUrl ?? ''),
    enabled: needsEcosystem
  })

  let ecosystem: EcosystemState = { status: 'unavailable' }
  if (needsEcosystem) {
    if (query.isError) ecosystem = { status: 'unavailable' }
    else if (query.data !== undefined) {
      ecosystem = { status: 'available', ecosystem: query.data }
    } else ecosystem = { status: 'loading' }
  }

  return resolvePremiumCta({
    capability,
    isInsideWorkplace,
    workplaceFqdn,
    ecosystem,
    owner: {
      email: username,
      domainName: getRootDomain(window.location.hostname)
    }
  })
}
