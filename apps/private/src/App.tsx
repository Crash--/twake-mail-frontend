import { createClient } from 'jmap-client-ts'
import { useState, type ReactElement } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { BrowserRouter } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { reportRenderError } from '@common/app/sentry'
import type { AppConfig } from '@common/config/config'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import { createAuthService } from '@common/features/auth/createAuthService'
import { useI18n } from '@common/i18n/useI18n'
import { findPreferredLanguage } from '@common/i18n/languages'
import { JmapClientProvider } from '@common/jmap/JmapClientProvider'

import { AppRoutes } from './AppRoutes'

function CrashScreen({ resetErrorBoundary }: FallbackProps): ReactElement {
  const { t } = useI18n()

  return (
    <ErrorScreen
      title={t('common.errorOccurred')}
      actionLabel={t('common.retry')}
      onAction={resetErrorBoundary}
      data-testid="crash-error"
    />
  )
}

function handleRenderError(
  error: unknown,
  info: { componentStack?: string | null }
): void {
  reportRenderError(error, info.componentStack ?? '')
}

export interface AppProps {
  config: AppConfig
}

export function App({ config }: AppProps): ReactElement {
  const [queryClient] = useState(makeQueryClient)
  const [authService] = useState(() => createAuthService(config))
  const [lang] = useState(() => findPreferredLanguage(config.defaultLanguage))

  return (
    <AppProviders lang={lang} queryClient={queryClient} debug={config.debug}>
      <ErrorBoundary
        FallbackComponent={CrashScreen}
        onError={handleRenderError}
      >
        <AuthProvider service={authService}>
          <JmapClientProvider
            createClient={createClient}
            sessionUrl={config.jmapSessionUrl}
          >
            <BrowserRouter>
              <AppRoutes apps={config.appList} debug={config.debug} />
            </BrowserRouter>
          </JmapClientProvider>
        </AuthProvider>
      </ErrorBoundary>
    </AppProviders>
  )
}
