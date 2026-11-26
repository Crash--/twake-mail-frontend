import type { ReactElement } from 'react'

import { useColorScheme } from '@linagora/twake-mui'
import { NewVersionDialog } from '@linagora/twake-react-new-version'

import { useAppConfig } from '@common/config/AppConfigProvider'
import { useAuthState } from '@common/features/auth/AuthProvider'

/**
 * The new version dialog when `NEW_VERSION_CHECK_ENABLED` is on; otherwise
 * nothing is mounted, so `/version.json` is never asked for. With
 * `notesAtLoad`, the release notes not seen yet in this browser show once
 * the user is signed in, never over the login page
 */
export function NewVersionCheck({
  notesAtLoad = false
}: {
  notesAtLoad?: boolean
}): ReactElement | null {
  const config = useAppConfig()
  const { colorScheme = 'light' } = useColorScheme()
  const isSignedIn = useAuthState().status === 'authenticated'
  if (config?.newVersionCheckEnabled !== true) return null
  return (
    <NewVersionDialog
      running={process.env.BUILD_VERSION ?? 'dev'}
      appName="Twake Mail"
      image={`/release-notes/whats-new-${colorScheme}.png`}
      seenNotesKey={notesAtLoad && isSignedIn ? 'twake-mail' : undefined}
      notesUrl={config.releaseNotesUrl ?? undefined}
    />
  )
}
