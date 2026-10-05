import '@linagora/twake-css/dist/utils.css'

import { StrictMode, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { ConfigErrorScreen } from '@common/components/ConfigErrorScreen'
import { getConfigResult } from '@common/config/config'
import { findPreferredLanguage } from '@common/i18n/languages'

import { App } from './App'

function ConfigErrorApp({ errors }: { errors: string[] }): ReactElement {
  const [queryClient] = useState(makeQueryClient)

  return (
    <AppProviders lang={findPreferredLanguage(null)} queryClient={queryClient}>
      <ConfigErrorScreen errors={errors} />
    </AppProviders>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

const configResult = getConfigResult()
// The error reporting does not start here: it needs the consent of the
// signed-in user (`SentryReportingSync`)
if (!configResult.ok) {
  console.error('[config] Invalid runtime configuration', configResult.errors)
}

createRoot(container).render(
  <StrictMode>
    {configResult.ok ? (
      <App config={configResult.value} />
    ) : (
      <ConfigErrorApp errors={configResult.errors} />
    )}
  </StrictMode>
)
