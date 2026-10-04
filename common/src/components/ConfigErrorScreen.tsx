import { Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { useI18n } from '@common/i18n/useI18n'

export interface ConfigErrorScreenProps {
  /** Technical details, meant for the administrator */
  errors: readonly string[]
}

export function ConfigErrorScreen({
  errors
}: ConfigErrorScreenProps): ReactElement {
  const { t } = useI18n()

  return (
    <ErrorScreen
      title={t('config.title')}
      data-testid="config-error"
      description={
        <>
          {t('config.description')}
          {errors.map(error => (
            <Typography
              key={error}
              component="code"
              variant="body2"
              className="u-db u-mt-half"
            >
              {error}
            </Typography>
          ))}
        </>
      }
    />
  )
}
