import { useAppConfig } from '@common/config/AppConfigProvider'
import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/**
 * The rail of the Twake apps stands in for the platform menus on a desktop,
 * once `TWAKE_RAIL` is on and the platform of the user answers (without it
 * there is no app to list)
 */
export function useIsRailShown(): boolean {
  const config = useAppConfig()
  const sdk = usePlatformSdk()
  const status = usePlatformStatus()
  const screenSize = useScreenSize()
  return (
    config?.twakeRail === true &&
    sdk !== null &&
    status !== 'public' &&
    screenSize === 'desktop'
  )
}
