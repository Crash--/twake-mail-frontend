import { Alert, Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { StorageUsage } from '@/ds/StorageUsage/StorageUsage'
import { formatSize } from '@common/features/email/formatSize'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { UpgradeStorageLink } from '@common/features/paywall/UpgradeStorageLink'
import { useI18n } from '@common/i18n/useI18n'

import { useStorageQuota } from './quota'

export interface StorageSettingsProps {
  section: SettingsSection
}

/** Settings > Storage: the space used and left (tmail-flutter `StorageView`) */
export function StorageSettings({
  section
}: StorageSettingsProps): ReactElement {
  const { t, lang } = useI18n()
  const query = useStorageQuota()
  const quota = query.data

  return (
    <SettingsSectionLayout section={section}>
      {query.isPending ? (
        <LoadingListSkeleton count={2} />
      ) : query.isError ? (
        <SecondaryText variant="body2" component="p">
          {t('common.errorOccurredShort')}
        </SecondaryText>
      ) : !quota ? (
        <SecondaryText
          variant="body2"
          component="p"
          data-testid="storage-unlimited"
        >
          {t('quota.unlimited')}
        </SecondaryText>
      ) : (
        <Box data-testid="storage-settings" data-used={quota.used}>
          <StorageUsage
            used={formatSize(quota.used, lang)}
            ofLimit={t('quota.usedOf', {
              limit: formatSize(quota.limit, lang)
            })}
            available={t('quota.availableLong', {
              count: formatSize(Math.max(0, quota.limit - quota.used), lang)
            })}
            percent={Math.min(
              100,
              Math.round((quota.used / quota.limit) * 100)
            )}
            state={
              quota.isFull ? 'full' : quota.isWarning ? 'warning' : 'normal'
            }
          />
          {quota.isWarning ? (
            <Alert severity="warning" className="u-mt-1">
              {t('quota.almostFull')}
            </Alert>
          ) : null}
          <UpgradeStorageLink
            label={t('quota.upgrade')}
            appearance="button"
            className="u-mt-1"
            data-testid="storage-upgrade-button"
          />
        </Box>
      )}
    </SettingsSectionLayout>
  )
}
