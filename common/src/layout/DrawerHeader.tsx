import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { AppTitle } from '@injected/layout/AppTitle'

import { HelpButton } from './HelpButton'
import { LogoutButton } from './LogoutButton'
import { SettingsButton } from './SettingsButton'

/**
 * The top of the folder drawer below the desktop size: the logotype. Without
 * the platform of Twake Workplace (no bar of its own above the bar of the
 * mail), as tmail-flutter's drawer: the help, the settings and the log out
 * too, which the bar of the mail leaves out. Framed by the Workplace, the
 * help and the settings alone. A phone has its settings at the foot of the
 * drawer.
 */
export function DrawerHeader(): ReactElement {
  const sdk = usePlatformSdk()
  const isPlatformActive = usePlatformStatus() !== 'public'
  // A phone lists them at the foot of the drawer
  const isPhone = useScreenSize() === 'mobile'

  return (
    <Box
      className="u-flex u-flex-auto u-flex-items-center u-ov-hidden"
      data-testid="drawer-header"
    >
      <Box className="u-flex-auto u-ov-hidden">
        {/* As tmail-flutter's drawer: a smaller logotype */}
        {sdk === null ? null : <AppTitle />}
      </Box>
      {isPlatformActive ? null : (
        <>
          <HelpButton />
          {isPhone ? null : <SettingsButton />}
          {sdk === null ? null : <LogoutButton />}
        </>
      )}
    </Box>
  )
}
