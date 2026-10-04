import { useEffect, type ReactElement } from 'react'
import { useLocation, useNavigate, useRouteError } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { reportRenderError } from '@common/app/sentry'
import { useI18n } from '@common/i18n/useI18n'

/**
 * What a page that failed to render shows, as the crash screen of the app:
 * the data router catches the errors of its routes before the error
 * boundary around it. Retrying renders the same location again.
 */
export function RouteErrorScreen(): ReactElement {
  const { t } = useI18n()
  const error = useRouteError()
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    reportRenderError(error, '')
  }, [error])

  const handleRetry = (): void => {
    // A new navigation to the same place resets the error of the route
    void navigate(`${pathname}${search}${hash}`, { replace: true })
  }

  return (
    <ErrorScreen
      title={t('common.errorOccurred')}
      actionLabel={t('common.retry')}
      onAction={handleRetry}
      data-testid="crash-error"
    />
  )
}
