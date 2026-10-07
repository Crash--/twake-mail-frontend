import { createSdk, type Sdk, type SdkStatus } from '@linagora/twake-sdk'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode
} from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import {
  useAuthService,
  useAuthState
} from '@common/features/auth/AuthProvider'
import { useIsEmbedded } from '@common/features/embedding/embedding'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { resolvePlatformUrl } from './platformUrl'

const PlatformContext = createContext<Sdk | null>(null)

/**
 * Creates the client of the Twake Workplace of the user (`@linagora/twake-sdk`)
 * for the platform top bar, except inside an iframe of the Workplace, which
 * shows the bar itself. In OIDC mode, with a workplace known from the SSO or
 * `WORKPLACE_FQDN_FALLBACK`, the ID token of the session is exchanged for a
 * token of the platform, kept in memory by the client and forgotten when the
 * session ends. Otherwise (basic mode, no workplace) the client stays
 * `public`: the bar shows without the menus of the platform.
 */
export function PlatformProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const config = useAppConfig()
  const service = useAuthService()
  const state = useAuthState()
  const { session } = useJmapSession()
  const isEmbedded = useIsEmbedded()
  const claim =
    state.status === 'authenticated' ? state.user.workplaceFqdn : null
  const fallback = config?.workplaceFqdnFallback ?? null
  const platformUrl = useMemo(
    () =>
      service.mode === 'oidc'
        ? resolvePlatformUrl({
            username: session.username,
            workplaceFqdn: claim,
            workplaceFqdnFallback: fallback
          })
        : null,
    [service.mode, session.username, claim, fallback]
  )
  const sdk = useMemo(() => {
    if (isEmbedded) return null
    if (platformUrl !== null) {
      // `waiting` until the effect below exchanges the ID token
      return createSdk({ platformURL: platformUrl })
    }
    // No platform to ask: the bar has nothing to load
    const offline = createSdk({ platformURL: window.location.origin })
    offline.logout()
    return offline
  }, [isEmbedded, platformUrl])

  useEffect(() => {
    if (sdk === null || platformUrl === null) return
    const idToken = service.mode === 'oidc' ? service.getIdToken() : null
    if (idToken === null) {
      sdk.logout()
      return
    }
    sdk.login(idToken).catch((error: unknown) => {
      // The bar stays, without the menus of the platform
      console.warn('[platform] Token exchange failed', error)
    })
    return () => {
      sdk.logout()
    }
  }, [sdk, platformUrl, service])

  return <PlatformContext value={sdk}>{children}</PlatformContext>
}

/**
 * The client of the platform bar: null inside an iframe of Twake Workplace,
 * whose bar is the one of the container
 */
export function usePlatformSdk(): Sdk | null {
  return useContext(PlatformContext)
}

/** Where the platform bar is: `public` when the platform is out of reach */
export function usePlatformStatus(): SdkStatus {
  const sdk = useContext(PlatformContext)
  const subscribe = useCallback(
    (listener: () => void) =>
      sdk === null ? () => undefined : sdk.onStatusChange(listener),
    [sdk]
  )
  return useSyncExternalStore<SdkStatus>(
    subscribe,
    () => sdk?.status ?? 'public'
  )
}
