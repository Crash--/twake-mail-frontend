import { Cloud, Icon, Refresh } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip, Typography } from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { StorageGauge } from '@/ds/StorageGauge/StorageGauge'
import { formatSize } from '@common/features/email/formatSize'
import { UpgradeStorageLink } from '@common/features/paywall/UpgradeStorageLink'
import { useI18n } from '@common/i18n/useI18n'

import { useStorageQuota } from './quota'

/**
 * The storage used, at the bottom of the sidebar, as the design shows it and
 * tmail-flutter's footer: the cloud and "Storage" with a refresh, a thin
 * gauge (warning, full), what is left, and, where the storage can be
 * upgraded (Twake Workplace), the way to do it
 */
export function QuotaIndicator(): ReactElement | null {
  const { t, lang } = useI18n()
  const labelId = useId()
  const query = useStorageQuota()
  const quota = query.data
  if (!quota) return null
  const percent = Math.min(100, Math.round((quota.used / quota.limit) * 100))
  const used = formatSize(quota.used, lang)
  const limit = formatSize(quota.limit, lang)
  const refreshLabel = t('common.refresh')

  return (
    <Box data-testid="quota-indicator" data-used={quota.used}>
      <Box className="u-flex u-flex-items-center">
        <Icon icon={Cloud} aria-hidden />
        <SecondaryText
          id={labelId}
          variant="caption"
          component="p"
          className="u-ml-half u-flex-auto"
        >
          {t('settings.sections.storage.title')}
        </SecondaryText>
        <Tooltip title={refreshLabel}>
          <IconButton
            size="small"
            aria-label={refreshLabel}
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch()
            }}
            data-testid="quota-refresh-button"
          >
            <Icon icon={Refresh} />
          </IconButton>
        </Tooltip>
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
      <UpgradeStorageLink
        label={t('quota.increase')}
        data-testid="quota-upgrade-link"
      />
    </Box>
  )
}
