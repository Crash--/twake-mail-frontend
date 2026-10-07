import type { QueryClient } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import { createClient } from 'jmap-client-ts'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'

import type { SpaceOverlay } from '@linagora/twake-mui'
import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import type { AppConfig } from '@common/config/config'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import type { AuthService } from '@common/features/auth/types'
import type { SupportedLanguage } from '@common/i18n/languages'
import {
  JmapClientProvider,
  type JmapClientFactory
} from '@common/jmap/JmapClientProvider'
import { JmapSessionProvider } from '@common/jmap/JmapSessionProvider'

import {
  FAKE_SESSION_URL,
  makeFakeJmapServer,
  type FakeJmapServer
} from './fakeJmapServer'
import { makeFakeBasicAuthService } from './makeFakeAuthService'

export interface RenderOptions {
  /** Initial location of the in-memory router */
  route?: string | { pathname: string; state?: unknown }
  /** Route pattern the element is mounted on, to read route params */
  path?: string
  /** Routes nested in the element's route, rendered by its `<Outlet />` */
  childRoutes?: ReactElement
  /** Extra routes rendered next to the element, e.g. redirection targets */
  routes?: ReactElement
  authService?: AuthService
  lang?: SupportedLanguage
  /** JMAP server the real JMAP client talks to; a default one otherwise */
  jmapServer?: FakeJmapServer
  /**
   * Loads the JMAP session before rendering the element, as the app does for
   * the mail screens (`useJmapSession`)
   */
  withJmapSession?: boolean
  /** The runtime configuration, for the screens that read it */
  config?: AppConfig
  /** The overlay of TwakeSpace the dialogs and docked windows go onto */
  overlay?: SpaceOverlay
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient
  jmapServer: FakeJmapServer
}

/**
 * Renders a component with the providers of the app: theme, translations,
 * query client, authentication, JMAP client (talking to a fake JMAP server)
 * and an in-memory router.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    path = '*',
    childRoutes,
    routes,
    authService = makeFakeBasicAuthService(),
    lang = 'en',
    jmapServer = makeFakeJmapServer(),
    withJmapSession = false,
    config,
    overlay
  }: RenderOptions = {}
): RenderWithProvidersResult {
  const queryClient = makeQueryClient()
  const defaultOptions = queryClient.getDefaultOptions()
  queryClient.setDefaultOptions({
    ...defaultOptions,
    queries: { ...defaultOptions.queries, retry: false }
  })
  const createFakeClient: JmapClientFactory = options =>
    createClient({ ...options, fetch: jmapServer.fetch })
  const session = withJmapSession ? (
    <JmapSessionProvider>{ui}</JmapSessionProvider>
  ) : (
    ui
  )
  const element = config ? (
    <AppConfigProvider config={config}>{session}</AppConfigProvider>
  ) : (
    session
  )

  const result = render(
    <AppProviders lang={lang} queryClient={queryClient} overlay={overlay}>
      <AuthProvider service={authService}>
        <JmapClientProvider
          createClient={createFakeClient}
          sessionUrl={FAKE_SESSION_URL}
        >
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={element}>
                {childRoutes}
              </Route>
              {routes}
            </Routes>
          </MemoryRouter>
        </JmapClientProvider>
      </AuthProvider>
    </AppProviders>
  )
  return { ...result, queryClient, jmapServer }
}
