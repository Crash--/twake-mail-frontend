import { Icon } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { Refresh } from '@/ds/FlutterIcons/FlutterIcons'
import { Quotas } from '@/ds/NavIcons/NavIcons'
import { NavSectionAction } from '@/ds/NavSectionAction/NavSectionAction'
import { SidebarStorage } from '@/ds/SidebarStorage/SidebarStorage'
import { StorageGauge } from '@/ds/StorageGauge/StorageGauge'
import { formatSize } from '@common/features/email/formatSize'
import { UpgradeStorageLink } from '@common/features/paywall/UpgradeStorageLink'
import { useI18n } from '@common/i18n/useI18n'

import { useStorageQuota } from './quota'

/** Past this share of the limit, tmail-flutter shows the storage used */
const SHOWN_FROM = 0.8

/**
 * The storage used, at the bottom of the sidebar, as tmail-flutter's footer:
 * once more than 80 % is used, the cloud and "Storage" with a refresh, a
 * thin gauge (warning, full) and what is left, or that it is full and how
 * much is used; and, where the storage can be upgraded (Twake Workplace),
 * the way to do it
 */
export function QuotaIndicator(): ReactElement | null {
  const { t, lang } = useI18n()
  const labelId = useId()
  const query = useStorageQuota()
  const quota = query.data
  if (!quota) return null
  const upgradeLink = (
    <UpgradeStorageLink
      label={t('quota.increase')}
      data-testid="quota-upgrade-link"
    />
  )
  if (quota.used <= quota.limit * SHOWN_FROM) return upgradeLink
  const percent = Math.min(100, Math.round((quota.used / quota.limit) * 100))
  const used = formatSize(quota.used, lang)
  const limit = formatSize(quota.limit, lang)

  return (
    <Box data-testid="quota-indicator" data-used={quota.used}>
      <SidebarStorage
        icon={<Icon icon={Quotas} size={24} />}
        labelId={labelId}
        label={t('settings.sections.storage.title')}
        action={
          <NavSectionAction
            label={t('quota.refresh')}
            icon={Refresh}
            iconSize={20}
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch()
            }}
            data-testid="quota-refresh-button"
          />
        }
        gauge={
          <StorageGauge
            value={percent}
            state={
              quota.isFull ? 'full' : quota.isWarning ? 'warning' : 'normal'
            }
            labelledBy={labelId}
            valueText={t('quota.state', { used, limit })}
          />
        }
        status={
          quota.isFull
            ? `${t('quota.outOfStorage')}\n${t('quota.state', { used, limit })}`
            : t('quota.available', {
                count: formatSize(Math.max(0, quota.limit - quota.used), lang)
              })
        }
        isError={quota.isFull}
        statusTestId={quota.isFull ? undefined : 'quota-text'}
      />
      {upgradeLink}
    </Box>
  )
}
