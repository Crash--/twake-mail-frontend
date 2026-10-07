import { useMemo, type ReactElement } from 'react'

import { AppGridMenu as AppGrid } from '@/ds/AppGridMenu/AppGridMenu'
import { useAppConfig } from '@common/config/AppConfigProvider'
import type { AppListEntry } from '@common/config/config'
import { resolveAppList } from '@common/features/apps/appList'
import { useAuthState } from '@common/features/auth/AuthProvider'
import { useIsEmbedded } from '@common/features/embedding/embedding'
import { usePlatformSdk } from '@common/features/platform/PlatformProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

const TEST_IDS = {
  button: 'app-grid-toggle-button',
  menu: 'app-grid-list',
  item: 'app-grid-item'
}

export interface AppGridMenuProps {
  apps: readonly AppListEntry[]
}

/**
 * Links to the other Twake applications, listed by `public/appList.js`,
 * their URI templates resolved for the user (the Twake Drive of each user
 * has its own address). Inside Twake Workplace the container has its own
 * grid, and the platform bar its menu of the apps: none here.
 */
export function AppGridMenu({ apps }: AppGridMenuProps): ReactElement | null {
  const { t } = useI18n()
  const config = useAppConfig()
  const state = useAuthState()
  const { session } = useJmapSession()
  const isEmbedded = useIsEmbedded()
  const hasPlatformBar = usePlatformSdk() !== null
  const workplaceFqdn =
    state.status === 'authenticated' ? state.user.workplaceFqdn : null
  const resolved = useMemo(
    () =>
      resolveAppList(apps, {
        username: session.username,
        workplaceFqdn,
        workplaceFqdnFallback: config?.workplaceFqdnFallback ?? null
      }),
    [apps, session.username, workplaceFqdn, config?.workplaceFqdnFallback]
  )

  if (isEmbedded || hasPlatformBar) return null
  return <AppGrid apps={resolved} label={t('topbar.apps')} testIds={TEST_IDS} />
}
