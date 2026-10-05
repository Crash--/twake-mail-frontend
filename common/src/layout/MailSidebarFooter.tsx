import type { ReactElement } from 'react'

import { SidebarFooter } from '@/ds/SidebarFooter/SidebarFooter'
import { useAppConfig } from '@common/config/AppConfigProvider'
import { QuotaIndicator } from '@common/features/quota/QuotaIndicator'
import { useI18n } from '@common/i18n/useI18n'

/**
 * The foot of the sidebar, as tmail-flutter's `MailboxSidebarFooter`: the
 * storage used (and the way to upgrade it) and the version of the app
 */
export function MailSidebarFooter(): ReactElement {
  const { t } = useI18n()
  const config = useAppConfig()

  return (
    <SidebarFooter
      version={
        config === null
          ? undefined
          : t('sidebar.version', { version: config.appVersion })
      }
      versionTestId="sidebar-version"
      data-testid="sidebar-footer"
    >
      <QuotaIndicator />
    </SidebarFooter>
  )
}
