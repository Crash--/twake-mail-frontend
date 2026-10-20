import { Alert, Button } from '@linagora/twake-mui'
import type { ReactElement, RefObject } from 'react'

import { useFocusFallback } from '@/ds/useFocusFallback/useFocusFallback'
import { useI18n } from '@common/i18n/useI18n'

export interface BodyLoadErrorBannerProps {
  /** Asks the server for the email again */
  onRetry: () => void
  /**
   * Where the focus goes when the banner goes away while holding it (the
   * content a retry brought replaced it): the heading or header of the
   * message
   */
  focusTarget: RefObject<HTMLElement | null>
}

/**
 * Says that the content of a message could not be loaded (a `serverFail` on
 * `Email/get`, a body part without value), with a way to try again: never an
 * empty message that would pass for the real one (tmail-flutter `tf#3487`).
 * An alert: screen readers hear it at once. A retry that fails again keeps
 * the banner, and the focus on Retry; one that succeeds removes it, the
 * focus then goes to `focusTarget`, never to the page body (RGAA 12.8).
 */
export function BodyLoadErrorBanner({
  onRetry,
  focusTarget
}: BodyLoadErrorBannerProps): ReactElement {
  const { t } = useI18n()
  const focusFallbackRef = useFocusFallback<HTMLDivElement>(focusTarget)
  return (
    <Alert
      ref={focusFallbackRef}
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
