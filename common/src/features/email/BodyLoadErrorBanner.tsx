import { Alert, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

export interface BodyLoadErrorBannerProps {
  /** Asks the server for the email again */
  onRetry: () => void
}

/**
 * Says that the content of a message could not be loaded (a `serverFail` on
 * `Email/get`, a body part without value), with a way to try again: never an
 * empty message that would pass for the real one (tmail-flutter `tf#3487`).
 * An alert: screen readers hear it at once.
 */
export function BodyLoadErrorBanner({
  onRetry
}: BodyLoadErrorBannerProps): ReactElement {
  const { t } = useI18n()
  return (
    <Alert
      severity="error"
      role="alert"
      className="u-mb-1"
      data-testid="email-body-error"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={onRetry}
          data-testid="email-body-retry-button"
        >
          {t('common.retry')}
        </Button>
      }
    >
      {t('email.bodyLoadFailed')}
    </Alert>
  )
}
