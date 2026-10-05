import { createClient } from 'jmap-client-ts'
import { useState, type ReactElement } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { createBrowserRouter, createRoutesFromElements } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { reportRenderError } from '@common/app/sentry'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import type { AppConfig } from '@common/config/config'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import { createAuthService } from '@common/features/auth/createAuthService'
import { useI18n } from '@common/i18n/useI18n'
import { findPreferredLanguage } from '@common/i18n/languages'
import { JmapClientProvider } from '@common/jmap/JmapClientProvider'

import { appRouteElements } from './AppRoutes'

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
  // A data router: navigations of its routes can run as view transitions
  // (the `viewTransition` option of `navigate`)
  const [router] = useState(() =>
    createBrowserRouter(
      createRoutesFromElements(appRouteElements({ apps: config.appList }))
    )
  )

  return (
    <AppConfigProvider config={config}>
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
              <RouterProvider router={router} />
            </JmapClientProvider>
          </AuthProvider>
        </ErrorBoundary>
      </AppProviders>
    </AppConfigProvider>
  )
}
