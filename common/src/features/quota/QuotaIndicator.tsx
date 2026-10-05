import { Cloud, Icon, Refresh } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { formatSize } from '@common/features/email/formatSize'
import { useI18n } from '@common/i18n/useI18n'

import { useStorageQuota } from './quota'

/**
 * The storage used, at the bottom of the sidebar, as tmail-flutter's
 * footer: a gauge (warning, full) and what is left, with a refresh
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
    <Box
      className="u-mh-1 u-mv-1"
      data-testid="quota-indicator"
      data-used={quota.used}
    >
      <Box className="u-flex u-flex-items-center">
        <Icon icon={Cloud} aria-hidden />
        <Typography
          id={labelId}
          variant="subtitle2"
          component="p"
          color="textPrimary"
          className="u-ml-half u-flex-auto"
        >
          {t('settings.sections.storage.title')}
        </Typography>
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
      <LinearProgress
        variant="determinate"
        value={percent}
        color={quota.isFull ? 'error' : quota.isWarning ? 'warning' : 'primary'}
        aria-labelledby={labelId}
        aria-valuetext={t('quota.state', { used, limit })}
        className="u-mv-half"
      />
      {quota.isFull ? (
        <Typography variant="caption" component="p" color="error.dark">
          {`${t('quota.outOfStorage')} ${t('quota.state', { used, limit })}`}
        </Typography>
      ) : (
        <SecondaryText variant="caption" component="p" data-testid="quota-text">
          {t('quota.state', { used, limit })}
        </SecondaryText>
      )}
    </Box>
  )
}
