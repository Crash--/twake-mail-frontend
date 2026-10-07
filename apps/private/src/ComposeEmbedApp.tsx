import { loginRequiredMessage } from '@linagora/twake-embed'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  Outlet,
  Route
} from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { useAuthService } from '@common/features/auth/AuthProvider'
import { RequireAuth } from '@common/features/auth/RequireAuth'
import { COMPOSE_EMBED_PATH } from '@common/features/composeEmbed/composeEmbedPath'
import { MailtoRoute } from '@common/features/composer/MailtoRoute'
import { JmapSessionProvider } from '@common/jmap/JmapSessionProvider'
import { MailProviders } from '@common/layout/AppLayout'

type Phase = 'callback' | 'ready' | 'login-required'

export interface ComposeEmbedAppProps {
  /**
   * The SSO came back to the callback page of the app (outside the facade)
   * for a login the facade started
   */
  callbackUrl: URL | null
}

/**
 * The facade of the composer (`/embed/compose?uri=mailto:…`): signs in
 * silently, opens a composer with what the link gives, and draws nothing in
 * its own frame. The composer goes onto the overlay of the framing page,
 * which shows the region it draws in; when the last composer closes, the
 * region is empty and the page may take its frames away. When the SSO needs
 * the user, the page is told (`twake-embed:login-required`): it opens Twake
 * Mail in a tab instead.
 */
export function ComposeEmbedApp({
  callbackUrl
}: ComposeEmbedAppProps): ReactElement | null {
  const service = useAuthService()
  const [phase, setPhase] = useState<Phase>(
    callbackUrl === null ? 'ready' : 'callback'
  )
  const hasRun = useRef(false)

  useEffect(() => {
    // The code can be exchanged once only: React strict mode runs effects twice
    if (callbackUrl === null || hasRun.current) return
    hasRun.current = true

    const completeLogin = async (): Promise<void> => {
      if (service.mode !== 'oidc') {
        setPhase('ready')
        return
      }
      const result = await service.handleCallback(callbackUrl)
      if (result.ok) {
        window.history.replaceState(null, '', result.value.returnTo)
        setPhase('ready')
        return
      }
      if (result.error !== 'login-required') {
        console.error('[auth] Login callback of the composer failed', result)
      }
      // Whatever went wrong, the page has another way: a tab of Twake Mail
      window.parent.postMessage(loginRequiredMessage(), '*')
      setPhase('login-required')
    }
    void completeLogin()
  }, [callbackUrl, service])

  if (phase !== 'ready') return null
  return <ComposeEmbedRouter />
}

/** Created once the address is the facade's: the router reads it */
function ComposeEmbedRouter(): ReactElement {
  const [router] = useState(() =>
    createBrowserRouter(createRoutesFromElements(composeEmbedRouteElements()), {
      basename: COMPOSE_EMBED_PATH
    })
  )

  return <RouterProvider router={router} />
}

/**
 * The one route of the facade: `/mailto` under its base, in the providers
 * the composer needs. Nothing shows while the login and the session load.
 */
export function composeEmbedRouteElements(): ReactElement {
  return (
    <Route element={<RequireAuth loading={null} />}>
      <Route
        element={
          <JmapSessionProvider loading={null}>
            <MailProviders>
              <Outlet />
            </MailProviders>
          </JmapSessionProvider>
        }
      >
        <Route index element={<MailtoRoute />} />
        <Route path="*" element={null} />
      </Route>
    </Route>
  )
}
