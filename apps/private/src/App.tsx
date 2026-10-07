import { createClient } from 'jmap-client-ts'
import { useState, type ReactElement } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { createBrowserRouter, createRoutesFromElements } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { reportRenderError } from '@common/app/sentry'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import type { AppConfig } from '@common/config/config'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import { createAuthService } from '@common/features/auth/createAuthService'
import { connectToSpace } from '@common/features/teamMailboxEmbed/spaceBridge'
import { useI18n } from '@common/i18n/useI18n'
import { JmapClientProvider } from '@common/jmap/JmapClientProvider'

import { appRouteElements } from './AppRoutes'
import {
  TeamMailboxEmbedApp,
  type TeamMailboxEmbed
} from './TeamMailboxEmbedApp'

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
  /** Decided by `AppBootstrap` before the configuration was complete */
  embed: TeamMailboxEmbed | null
}

/** The app, under the providers `AppBootstrap` mounts for the whole page */
export function App({ config, embed }: AppProps): ReactElement {
  const [spaceBridge] = useState(() =>
    embed === null
      ? null
      : connectToSpace(config.twakeSpaceOrigin, embed.target)
  )
  const [authService] = useState(() =>
    createAuthService(config, {
      framed: embed !== null && window.parent !== window
    })
  )

  return (
    <AppConfigProvider config={config}>
      <ErrorBoundary
        FallbackComponent={CrashScreen}
        onError={handleRenderError}
      >
        <AuthProvider service={authService}>
          <JmapClientProvider
            createClient={createClient}
            sessionUrl={config.jmapSessionUrl}
          >
            {embed === null ? (
              <WebmailRouter config={config} />
            ) : (
              <TeamMailboxEmbedApp embed={embed} spaceBridge={spaceBridge} />
            )}
          </JmapClientProvider>
        </AuthProvider>
      </ErrorBoundary>
    </AppConfigProvider>
  )
}

function WebmailRouter({ config }: { config: AppConfig }): ReactElement {
  // A data router: navigations of its routes can run as view transitions
  // (the `viewTransition` option of `navigate`)
  const [router] = useState(() =>
    createBrowserRouter(
      createRoutesFromElements(appRouteElements({ apps: config.appList }))
    )
  )

  return <RouterProvider router={router} />
}
