import type { ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  usePlatformSdk,
  usePlatformStatus
} from '@common/features/platform/PlatformProvider'

import { HelpButton } from './HelpButton'
import { LogoutButton } from './LogoutButton'
import { PlatformBar } from './PlatformBar'
import { TopBar } from './TopBar'

export interface AppHeaderProps {
  /** Opens the folder drawer, below the desktop size */
  onOpenFolders: () => void
}

/**
 * The bars at the top of the app. The platform bar of Twake Workplace holds
 * the logotype, the apps and the account, and the help of the mail server on
 * a desktop, whose search and settings are in the page; smaller screens keep
 * the bar of the mail under it, for the folders, the search and the
 * settings. Without the platform, a log out button stands in for its
 * account menu. Inside an iframe of the Workplace, the container shows the
 * platform bar.
 */
export function AppHeader({ onOpenFolders }: AppHeaderProps): ReactElement {
  const sdk = usePlatformSdk()
  const status = usePlatformStatus()
  const isDesktop = useScreenSize() === 'desktop'
  const mailBar = isDesktop ? null : <TopBar onOpenFolders={onOpenFolders} />

  if (sdk === null) return <>{mailBar}</>
  return (
    <>
      <PlatformBar
        sdk={sdk}
        actions={
          <>
            {isDesktop ? <HelpButton /> : null}
            {status === 'public' ? <LogoutButton /> : null}
          </>
        }
      />
      {mailBar}
    </>
  )
}
