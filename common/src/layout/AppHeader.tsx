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
 * The bars at the top of the app. On a desktop, as tmail-flutter, the
 * platform bar of Twake Workplace holds the logotype, the search (out of the
 * settings), the help, the settings, the apps and the account; smaller
 * screens keep the bar of the mail under it, for the folders, the search and
 * the settings. Without the platform, a log out button stands in for its
 * account menu. Inside an iframe of the Workplace, the container shows the
 * platform bar, and the search is in the page.
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
  return (
    <AppBarFrame>
      <PlatformBar
        sdk={sdk}
        left={
          <AppBarLeft width={SIDEBAR_WIDTH}>
            <AppTitle />
          </AppBarLeft>
        }
        search={
          isSettings ? null : (
            <AppBarSearch>
              <MailSearchRow data-testid="search-row" />
            </AppBarSearch>
          )
        }
        actions={
          <>
            <HelpButton />
            {isSettings ? null : <SettingsButton />}
            {status === 'public' ? <LogoutButton /> : null}
          </>
        }
      />
    </AppBarFrame>
  )
}
