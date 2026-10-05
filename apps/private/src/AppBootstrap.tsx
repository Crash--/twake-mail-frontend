import { CircularProgress } from '@linagora/twake-mui'
import { useEffect, useState, type ReactElement } from 'react'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { completeConfig } from '@common/config/completeConfig'
import type { AppConfig } from '@common/config/config'
import { findPreferredLanguage } from '@common/i18n/languages'
import { useI18n } from '@common/i18n/useI18n'

import { App } from './App'

function BootScreen(): ReactElement {
  const { t } = useI18n()

  return (
    <div className="u-flex u-flex-justify-center u-flex-items-center u-h-100">
      <CircularProgress aria-label={t('common.loading')} />
    </div>
  )
}

export interface AppBootstrapProps {
  config: AppConfig
}

/**
 * Starts the app once the configuration is complete (`completeConfig`): a
 * progress indicator shows meanwhile.
 */
export function AppBootstrap({ config }: AppBootstrapProps): ReactElement {
  const [queryClient] = useState(makeQueryClient)
  const [completed, setCompleted] = useState<AppConfig | null>(null)

  useEffect(() => {
    let isCurrent = true
    completeConfig(config)
      .then(result => {
        if (isCurrent) setCompleted(result)
      })
      .catch(() => {
        if (isCurrent) setCompleted(config)
      })
    return () => {
      isCurrent = false
    }
  }, [config])

  if (completed !== null) return <App config={completed} />

  return (
    <AppProviders
      lang={findPreferredLanguage(config.defaultLanguage)}
      queryClient={queryClient}
    >
      <BootScreen />
    </AppProviders>
  )
}
