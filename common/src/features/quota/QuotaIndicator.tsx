import { Icon } from '@linagora/twake-icons'
import { Box, Typography } from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { Cloud, Refresh } from '@/ds/FlutterIcons/FlutterIcons'
import { NavSectionAction } from '@/ds/NavSectionAction/NavSectionAction'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
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
 * thin gauge (warning, full) and what is left; and, where the storage can be
 * upgraded (Twake Workplace), the way to do it
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
      <Box className="u-flex u-flex-items-center">
        <Icon icon={Cloud} size={24} aria-hidden />
        <SecondaryText
          id={labelId}
          variant="caption"
          component="p"
          className="u-ml-half u-flex-auto"
        >
          {t('settings.sections.storage.title')}
        </SecondaryText>
        <NavSectionAction
          label={t('quota.refresh')}
          icon={Refresh}
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch()
          }}
          data-testid="quota-refresh-button"
        />
      </Box>
      <StorageGauge
        value={percent}
        state={quota.isFull ? 'full' : quota.isWarning ? 'warning' : 'normal'}
        labelledBy={labelId}
        valueText={t('quota.state', { used, limit })}
        className="u-mv-half"
      />
      {quota.isFull ? (
        <Typography variant="caption" component="p" color="error.dark">
          {`${t('quota.outOfStorage')} ${t('quota.state', { used, limit })}`}
        </Typography>
      ) : (
        <SecondaryText variant="caption" component="p" data-testid="quota-text">
          {t('quota.available', {
            count: formatSize(Math.max(0, quota.limit - quota.used), lang)
          })}
        </SecondaryText>
      )}
      {upgradeLink}
    </Box>
  )
}
