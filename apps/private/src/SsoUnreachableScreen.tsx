import type { ReactElement } from 'react'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { useI18n } from '@common/i18n/useI18n'

export interface SsoUnreachableScreenProps {
  /** The discovery of the SSO did not get an answer, or failed otherwise */
  reason: 'sso-unreachable' | 'unexpected'
  onRetry: () => void
}

/**
 * The page when the app cannot start: Retry takes the focus, and keeps it
 * while the screen stays through the next attempts
 */
export function SsoUnreachableScreen({
  reason,
  onRetry
}: SsoUnreachableScreenProps): ReactElement {
  const { t } = useI18n()
  const isUnreachable = reason === 'sso-unreachable'
  const title = isUnreachable
    ? t('login.ssoUnreachableTitle')
    : t('common.errorOccurred')
  // The title of the tab stays short
  useDocumentTitle(isUnreachable ? title : t('login.startErrorTitle'))

  return (
    <ErrorScreen
      title={title}
      {...(isUnreachable
        ? { description: t('login.ssoUnreachableDescription') }
        : {})}
      actionLabel={t('common.retry')}
      onAction={onRetry}
      focusOnMount
      data-testid={isUnreachable ? 'sso-unreachable' : 'start-error'}
    />
  )
}
