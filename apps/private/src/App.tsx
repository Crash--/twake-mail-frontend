import { createClient } from 'jmap-client-ts'
import { useState, type ReactElement } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { createBrowserRouter, createRoutesFromElements } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { AlwaysFloatingAction } from '@/ds/FloatingActionButton/FloatingActionButton'
import { connectSpaceOverlay } from '@/ds/SpaceOverlay/spaceOverlay'
import { WithoutTablets } from '@/ds/useScreenSize/useScreenSize'
import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { reportRenderError } from '@common/app/sentry'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import type { AppConfig } from '@common/config/config'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import { createAuthService } from '@common/features/auth/createAuthService'
import { peekPendingLoginReturnTo } from '@common/features/auth/oidcAuth'
import { connectToSpace } from '@common/features/teamMailboxEmbed/spaceBridge'
import { parseTeamMailboxEmbedPath } from '@common/features/teamMailboxEmbed/teamMailboxEmbedPath'
import { useI18n } from '@common/i18n/useI18n'
import { findPreferredLanguage } from '@common/i18n/languages'
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

/**
 * The facade of a team mailbox the page is for: its path, or the login
 * callback of a login it started (the callback path is outside its base)
 */
function findTeamMailboxEmbed(config: AppConfig): TeamMailboxEmbed | null {
  const { pathname, href } = window.location
  const target = parseTeamMailboxEmbedPath(pathname)
  if (target !== null) return { target, callbackUrl: null }
  if (config.oidc === null) return null
  if (pathname !== new URL(config.oidc.redirectUri).pathname) return null
  const returnTo = peekPendingLoginReturnTo()
  const pending = returnTo === null ? null : parseTeamMailboxEmbedPath(returnTo)
  return pending === null
    ? null
    : { target: pending, callbackUrl: new URL(href) }
}

export interface AppProps {
  config: AppConfig
}

export function App({ config }: AppProps): ReactElement {
  const [queryClient] = useState(makeQueryClient)
  const [embed] = useState(() => findTeamMailboxEmbed(config))
  const [spaceBridge] = useState(() =>
    embed === null ? null : connectToSpace(config.twakeSpaceOrigin)
  )
  // Framed by TwakeSpace, the composer and the dialogs go onto its page
  const [overlay] = useState(() =>
    spaceBridge === null
      ? null
      : connectSpaceOverlay(spaceBridge.reportOverlayRegion)
  )
  const [authService] = useState(() =>
    createAuthService(config, {
      framed: embed !== null && window.parent !== window
    })
  )
  const [lang] = useState(() => findPreferredLanguage(config.defaultLanguage))

  const app = (
    <AppConfigProvider config={config}>
      <AppProviders
        lang={lang}
        queryClient={queryClient}
        debug={config.debug}
        overlay={overlay}
      >
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
      </AppProviders>
    </AppConfigProvider>
  )
  if (embed === null) return app
  // The facade is a desktop from 600 px: its frame is narrower than the
  // screen of TwakeSpace, where a tablet layout would surprise. Its "New
  // message" button floats at every size: the toasts keep above it.
  return (
    <WithoutTablets>
      <AlwaysFloatingAction>{app}</AlwaysFloatingAction>
    </WithoutTablets>
  )
}

function WebmailRouter({ config }: AppProps): ReactElement {
  // A data router: navigations of its routes can run as view transitions
  // (the `viewTransition` option of `navigate`)
  const [router] = useState(() =>
    createBrowserRouter(
      createRoutesFromElements(appRouteElements({ apps: config.appList }))
    )
  )

  return <RouterProvider router={router} />
}
