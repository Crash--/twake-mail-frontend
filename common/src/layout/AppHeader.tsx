import type { ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { AppListEntry } from '@common/config/config'
import { usePlatformSdk } from '@common/features/platform/PlatformProvider'

import { HelpButton } from './HelpButton'
import { PlatformBar } from './PlatformBar'
import { TopBar } from './TopBar'

export interface AppHeaderProps {
  apps: readonly AppListEntry[]
  /** Opens the folder drawer, below the desktop size */
  onOpenFolders: () => void
}

/**
 * The bars at the top of the app. With the platform bar of Twake Workplace,
 * it holds the logotype, the apps and the account, and the help of the mail
 * on a desktop, whose search and settings are in the page; smaller screens
 * keep the bar of the app under it, for the folders, the search and the
 * settings.
 * Without it, the bar of the app alone.
 */
export function AppHeader({
  apps,
  onOpenFolders
}: AppHeaderProps): ReactElement {
  const sdk = usePlatformSdk()
  const isDesktop = useScreenSize() === 'desktop'

  if (sdk === null) return <TopBar apps={apps} onOpenFolders={onOpenFolders} />
  return (
    <>
      <PlatformBar sdk={sdk} actions={isDesktop ? <HelpButton /> : null} />
      {isDesktop ? null : (
        <TopBar apps={apps} onOpenFolders={onOpenFolders} isUnderPlatformBar />
      )}
    </>
  )
}
