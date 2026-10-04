import type { ReactElement } from 'react'

import { FullPageLoader as Loader } from '@/ds/FullPageLoader/FullPageLoader'
import { useI18n } from '@common/i18n/useI18n'

export function FullPageLoader(): ReactElement {
  const { t } = useI18n()

  return <Loader label={t('common.loading')} data-testid="full-page-loader" />
}
