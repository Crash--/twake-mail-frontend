import type { QueryClient } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import { createClient } from 'jmap-client-ts'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
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
    withJmapSession = false
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
  const element = withJmapSession ? (
    <JmapSessionProvider>{ui}</JmapSessionProvider>
  ) : (
    ui
  )

  const result = render(
    <AppProviders lang={lang} queryClient={queryClient}>
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
