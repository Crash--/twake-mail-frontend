import { SdkProvider, TwakeRail } from '@linagora/twake-bar'
import type { ReactElement } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import { usePlatformSdk } from '@common/features/platform/PlatformProvider'

import { useLogout } from './useLogout'

/**
 * The apps of Twake Workplace as a rail at the left of the page
 * (`@linagora/twake-bar`), under the same platform as `PlatformBar`. Moving
 * to another app is a page navigation; the apps of `TWAKE_RAIL_PRERENDER`
 * load ahead.
 */
export function PlatformRail(): ReactElement | null {
  const sdk = usePlatformSdk()
  const config = useAppConfig()
  const handleLogout = useLogout()

  if (sdk === null) return null
  return (
    <SdkProvider client={sdk}>
      <TwakeRail
        current="mail"
        prerender={config?.twakeRailPrerender}
        onLogOut={handleLogout}
      />
    </SdkProvider>
  )
}
