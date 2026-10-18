import type { ReactElement } from 'react'
import type { FallbackProps } from 'react-error-boundary'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { useI18n } from '@common/i18n/useI18n'

/** What the app shows when it fails to render: the whole page */
export function CrashScreen({
  resetErrorBoundary
}: FallbackProps): ReactElement {
  const { t } = useI18n()

  return (
    <ErrorScreen
      title={t('common.errorOccurred')}
      headingLevel="h1"
      actionLabel={t('common.retry')}
      onAction={resetErrorBoundary}
      data-testid="crash-error"
    />
  )
}
