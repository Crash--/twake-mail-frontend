import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'
import { AppTitle } from '@injected/layout/AppTitle'

import { HelpButton } from './HelpButton'
import { LogoutButton } from './LogoutButton'
import { SettingsButton } from './SettingsButton'

/**
 * The top of the folder drawer below the desktop size: the logotype. Without
 * the platform of Twake Workplace (no bar of its own above the bar of the
 * mail), as tmail-flutter's drawer: the help, the settings and the log out
 * too, which the bar of the mail leaves out. Framed by the Workplace, the
 * help and the settings alone.
 */
export function DrawerHeader(): ReactElement {
  const sdk = usePlatformSdk()
  const isPlatformActive = usePlatformStatus() !== 'public'

  return (
    <Box
      className="u-flex u-flex-auto u-flex-items-center u-ov-hidden"
      data-testid="drawer-header"
    >
      <Box className="u-flex-auto u-ov-hidden">
        {sdk === null ? null : <AppTitle />}
      </Box>
      {isPlatformActive ? null : (
        <>
          <HelpButton />
          <SettingsButton />
          {sdk === null ? null : <LogoutButton />}
        </>
      )}
    </Box>
  )
}
