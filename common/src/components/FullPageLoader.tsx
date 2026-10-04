import { Box, CircularProgress } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

export function FullPageLoader(): ReactElement {
  const { t } = useI18n()

  return (
    <Box
      className="u-flex u-flex-items-center u-flex-justify-center u-h-100"
      data-testid="full-page-loader"
    >
      <CircularProgress aria-label={t('common.loading')} />
    </Box>
  )
}
