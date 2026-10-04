import type { ReactElement } from 'react'

import { AppGridMenu as AppGrid } from '@/ds/AppGridMenu/AppGridMenu'
import type { AppListEntry } from '@common/config/config'
import { useI18n } from '@common/i18n/useI18n'

const TEST_IDS = {
  button: 'app-grid-toggle-button',
  menu: 'app-grid-list',
  item: 'app-grid-item'
}

export interface AppGridMenuProps {
  apps: readonly AppListEntry[]
}

/**
 * Links to the other Twake applications, listed by `public/appList.js`.
 */
export function AppGridMenu({ apps }: AppGridMenuProps): ReactElement | null {
  const { t } = useI18n()

  return <AppGrid apps={apps} label={t('topbar.apps')} testIds={TEST_IDS} />
}
