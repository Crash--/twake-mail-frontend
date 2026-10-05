import { Alert, AlertTitle } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { UpgradeStorageLink } from '@common/features/paywall/UpgradeStorageLink'
import { usePremiumCta } from '@common/features/paywall/usePremiumCta'
import { useI18n } from '@common/i18n/useI18n'

import { useStorageQuota } from './quota'

/**
 * Above the lists, once the storage reaches the warning limit of the
 * server or is full, as tmail-flutter's quota banner; closed for the
 * session. With a way to upgrade the storage (Twake Workplace), it links to it
 */
export function QuotaBanner(): ReactElement | null {
  const { t } = useI18n()
  const { data: quota } = useStorageQuota()
  const isPremiumAvailable = usePremiumCta().status === 'available'
  const [isDismissed, setIsDismissed] = useState(false)
  if (!quota?.isWarning || isDismissed) return null

  return (
    <Alert
      severity={quota.isFull ? 'error' : 'warning'}
      className="u-m-1"
      onClose={() => {
        setIsDismissed(true)
      }}
      slotProps={{ closeButton: { 'aria-label': t('quota.dismiss') } }}
      data-testid="quota-banner"
    >
      <AlertTitle>
        {t(quota.isFull ? 'quota.banner.full' : 'quota.banner.low')}
      </AlertTitle>
      {t(
        isPremiumAvailable
          ? 'quota.banner.adviceWithPremium'
          : 'quota.banner.advice'
      )}
      {isPremiumAvailable ? (
        <>
          {' '}
          <UpgradeStorageLink
            label={t('quota.manage')}
            data-testid="quota-banner-upgrade-link"
          />
        </>
      ) : null}
    </Alert>
  )
}
