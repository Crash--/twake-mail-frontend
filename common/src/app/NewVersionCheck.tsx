import type { ReactElement } from 'react'

import { useColorScheme } from '@linagora/twake-mui'
import { NewVersionDialog } from '@linagora/twake-react-new-version'

import { useAppConfig } from '@common/config/AppConfigProvider'

/**
 * The new version dialog when `NEW_VERSION_CHECK_ENABLED` is on; otherwise
 * nothing is mounted, so `/version.json` is never asked for
 */
export function NewVersionCheck(): ReactElement | null {
  const config = useAppConfig()
  const { colorScheme = 'light' } = useColorScheme()
  if (config?.newVersionCheckEnabled !== true) return null
  return (
    <NewVersionDialog
      running={process.env.BUILD_VERSION ?? 'dev'}
      appName="Twake Mail"
      image={`/release-notes/whats-new-${colorScheme}.png`}
    />
  )
}
