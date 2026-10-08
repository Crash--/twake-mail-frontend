import type { ReactElement } from 'react'
import { useLocation } from 'react-router'

import {
  AppBarFrame,
  AppBarLeft,
  AppBarSearch
} from '@/ds/AppBarFrame/AppBarFrame'
import { SIDEBAR_WIDTH } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'
import { isSettingsPath } from '@common/features/settings/SettingsExitProvider'
import { AppTitle } from '@injected/layout/AppTitle'

import { HelpButton } from './HelpButton'
import { LogoutButton } from './LogoutButton'
import { MailSearchRow } from './MailSearchRow'
import { PlatformBar } from './PlatformBar'
import { SettingsButton } from './SettingsButton'
import { TopBar } from './TopBar'

export interface AppHeaderProps {
  /** Opens the folder drawer, below the desktop size */
  onOpenFolders: () => void
}

/**
 * The bars at the top of the app. With the platform of Twake Workplace, its
 * bar as in every app of the platform (home, title, help, apps, account),
 * the search and the settings at the top of the page on a desktop. Without
 * the platform (`public`), on a desktop, tmail-flutter's bar: the logotype,
 * the search (out of the settings), the help, the settings and a log out
 * button. Smaller screens keep the bar of the mail under the platform bar,
 * for the folders, the search and the settings. Inside an iframe of the
 * Workplace, the container shows the platform bar, and the search is in the
 * page.
 */
export function AppHeader({ onOpenFolders }: AppHeaderProps): ReactElement {
  const sdk = usePlatformSdk()
  const status = usePlatformStatus()
  const isDesktop = useScreenSize() === 'desktop'
  const isSettings = isSettingsPath(useLocation().pathname)
  const mailBar = isDesktop ? null : <TopBar onOpenFolders={onOpenFolders} />

  if (sdk === null) return <>{mailBar}</>
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
        search={
          isFlutterBar && !isSettings ? (
            <AppBarSearch>
              <MailSearchRow data-testid="search-row" />
            </AppBarSearch>
          ) : null
        }
        actions={
          <>
            <HelpButton />
            {isFlutterBar && !isSettings ? <SettingsButton /> : null}
            {isFlutterBar ? <LogoutButton /> : null}
          </>
        }
      />
    </AppBarFrame>
  )
}
