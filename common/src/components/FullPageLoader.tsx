import type { ReactElement } from 'react'

import { FullPageLoader as Loader } from '@/ds/FullPageLoader/FullPageLoader'
import { useLoadingAnnouncement } from '@common/features/loading/LoadingAnnouncer'
import { useI18n } from '@common/i18n/useI18n'

/**
 * The spinner of the whole page while the app boots (configuration, SSO,
 * JMAP session): the page's "Loading" live region announces it, a
 * progress bar alone is not read out.
 */
export function FullPageLoader(): ReactElement {
  const { t } = useI18n()
  useLoadingAnnouncement(true)

  return <Loader label={t('common.loading')} data-testid="full-page-loader" />
}
