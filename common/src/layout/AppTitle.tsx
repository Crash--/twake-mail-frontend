import type { ReactElement } from 'react'

import { AppTitle as Logotype } from '@/ds/AppTitle/AppTitle'
import { useI18n } from '@common/i18n/useI18n'

/**
 * The Twake Mail logotype of the top bar and the login card. Injectable, so
 * that a deployment can brand it: `@injected/layout/AppTitle`.
 */
export function AppTitle({
  height
}: {
  /** In px, 33 by default (22 in the folder drawer, as tmail-flutter) */
  height?: number
}): ReactElement {
  const { t } = useI18n()

  return (
    <Logotype label={t('app.name')} height={height} data-testid="app-title" />
  )
}
