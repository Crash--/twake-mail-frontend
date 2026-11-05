import type { ReactElement } from 'react'

import { AppBarFrame, AppBarLeft } from '@/ds/AppBarFrame/AppBarFrame'
import { SIDEBAR_WIDTH } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'
import { AppTitle } from '@injected/layout/AppTitle'

import { AccountMenu } from './AccountMenu'
import { HelpButton } from './HelpButton'
import { LogoutButton } from './LogoutButton'
import { PlatformBar } from './PlatformBar'
import { TopBar } from './TopBar'

export interface AppHeaderProps {
  /** Opens the folder drawer, below the desktop size */
  onOpenFolders: () => void
  /**
   * An email fills the screen: without the platform, the bar of the mail
   * goes, as tmail-flutter does (the reading view has its own bar)
   */
  isEmailFullScreen?: boolean
}

/**
 * The bars at the top of the app. With the platform of Twake Workplace, its
 * bar as in every app of the platform (home, title, help, apps, account).
 * Without the platform (`public`), on a desktop, the logotype, the help,
 * and the settings and the log out behind the initial of the user. On a
 * desktop the search and the settings start the page. Smaller screens keep the bar of the mail under the platform bar,
 * for the folders, the search and the settings. Inside an iframe of the
 * Workplace, the container shows the platform bar, and the search is in the
 * page.
 */
export function AppHeader({
  onOpenFolders,
  isEmailFullScreen = false
}: AppHeaderProps): ReactElement {
  const sdk = usePlatformSdk()
  const status = usePlatformStatus()
  const isDesktop = useScreenSize() === 'desktop'
  const mailBar =
    isDesktop || (isEmailFullScreen && status === 'public') ? null : (
      <TopBar onOpenFolders={onOpenFolders} />
    )

  // Without the platform (basic sign-in, no Workplace), phones and tablets
  // have the bar of the mail alone, as tmail-flutter: the drawer holds the
  // help, the settings and the log out (`DrawerHeader`)
  if (sdk === null || (!isDesktop && status === 'public')) {
    return <>{mailBar}</>
  }
  if (!isDesktop) {
    return (
      <>
        <PlatformBar
          sdk={sdk}
          actions={status === 'public' ? <LogoutButton /> : null}
        />
        {mailBar}
      </>
    )
  }
  // With the platform (Twake Workplace), its bar stays as in every app of
  // the platform: its home, the title, help, apps and account. The same
  // bar, only dressed otherwise, when the platform answers late or refuses
  const isFlutterBar = status === 'public'
  return (
    <AppBarFrame isPlain={!isFlutterBar}>
      <PlatformBar
        sdk={sdk}
        left={
          isFlutterBar ? (
            <AppBarLeft width={SIDEBAR_WIDTH}>
              <AppTitle />
            </AppBarLeft>
          ) : undefined
        }
        actions={
          <>
            <HelpButton size="small" />
            {/* As tmail-flutter: the settings and the sign out are behind
                the initial of the user */}
            {isFlutterBar ? <AccountMenu /> : null}
          </>
        }
      />
    </AppBarFrame>
  )
}
