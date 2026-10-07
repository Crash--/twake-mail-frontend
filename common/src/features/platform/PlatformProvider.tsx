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
 * for the platform top bar: `TWAKE_BAR_ENABLED`, the OIDC mode, outside an
 * iframe of the Workplace (which has its own bar), and a workplace known
 * from the SSO or `WORKPLACE_FQDN_FALLBACK`. The ID token of the session is
 * exchanged for a token of the platform, kept in memory by the client; the
 * client forgets it when the session ends.
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
  const isEnabled =
    config?.twakeBarEnabled === true && service.mode === 'oidc' && !isEmbedded
  const claim =
    state.status === 'authenticated' ? state.user.workplaceFqdn : null
  const fallback = config?.workplaceFqdnFallback ?? null
  const platformUrl = useMemo(
    () =>
      isEnabled
        ? resolvePlatformUrl({
            username: session.username,
            workplaceFqdn: claim,
            workplaceFqdnFallback: fallback
          })
        : null,
    [isEnabled, session.username, claim, fallback]
  )
  // `waiting` until the effect below exchanges the ID token
  const sdk = useMemo(
    () =>
      platformUrl === null ? null : createSdk({ platformURL: platformUrl }),
    [platformUrl]
  )

  useEffect(() => {
    if (sdk === null) return
    const idToken = service.mode === 'oidc' ? service.getIdToken() : null
    if (idToken === null) {
      sdk.logout()
      return
    }
    sdk.login(idToken).catch((error: unknown) => {
      // The bar gives way to the one of the app: nothing to tell the user
      console.warn('[platform] Token exchange failed', error)
    })
    return () => {
      sdk.logout()
    }
  }, [sdk, service])

  return <PlatformContext value={sdk}>{children}</PlatformContext>
}

/**
 * The client of the platform while its top bar is shown: null when the bar
 * is off, and once the platform refused the token exchange (the app then
 * shows its own logotype, app grid and account menu)
 */
export function usePlatformSdk(): Sdk | null {
  const sdk = useContext(PlatformContext)
  const subscribe = useCallback(
    (listener: () => void) =>
      sdk === null ? () => undefined : sdk.onStatusChange(listener),
    [sdk]
  )
  const status = useSyncExternalStore<SdkStatus>(
    subscribe,
    () => sdk?.status ?? 'public'
  )
  return status === 'public' ? null : sdk
}
