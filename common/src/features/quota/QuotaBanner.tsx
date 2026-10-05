import { Alert, AlertTitle } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { useStorageQuota } from './quota'

/**
 * Above the lists, once the storage reaches the warning limit of the
 * server or is full, as tmail-flutter's quota banner; closed for the
 * session
 */
export function QuotaBanner(): ReactElement | null {
  const { t } = useI18n()
  const { data: quota } = useStorageQuota()
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
      {t('quota.banner.advice')}
    </Alert>
  )
}
