import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route
} from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { FullPageLoader } from '@common/components/FullPageLoader'
import { useAuthService } from '@common/features/auth/AuthProvider'
import { RequireAuth } from '@common/features/auth/RequireAuth'
import { INTENTS_PATH } from '@common/features/intents/intentPath'
import {
  IntentMessageScreen,
  IntentPage
} from '@common/features/intents/IntentPage'
import { JmapSessionProvider } from '@common/jmap/JmapSessionProvider'

export interface IntentsPage {
  /** Null on a path under `/intents` that serves no intent */
  intentId: string | null
  /**
   * The SSO came back to the callback of the intents page
   * (`/intents/callback`) for a login it started
   */
  callbackUrl: URL | null
}

type Phase = 'callback' | 'ready' | 'login-required' | 'failed'

export interface IntentsAppProps {
  page: IntentsPage
}

/**
 * The `/intents` page, framed by the app that started a cozy-stack intent
 * (Twake Chat…): signs in silently (`prompt=none`, no login form in a
 * frame), then serves the intent. The login callback is handled here: a
 * session the SSO cannot renew without the user says so in the frame.
 */
export function IntentsApp({ page }: IntentsAppProps): ReactElement {
  const { intentId } = page
  if (intentId === null) return <IntentMessageScreen message="unavailable" />
  return <IntentsLogin intentId={intentId} callbackUrl={page.callbackUrl} />
}

interface IntentsLoginProps {
  intentId: string
  callbackUrl: URL | null
}

function IntentsLogin({
  intentId,
  callbackUrl
}: IntentsLoginProps): ReactElement {
  const service = useAuthService()
  const [phase, setPhase] = useState<Phase>(
    callbackUrl === null ? 'ready' : 'callback'
  )
  const hasRun = useRef(false)

  useEffect(() => {
    // The code can be exchanged once only: React strict mode runs effects twice
    if (callbackUrl === null || hasRun.current) return
    hasRun.current = true
    const intentPath = `${INTENTS_PATH}?intent=${intentId}`

    const completeLogin = async (): Promise<void> => {
      if (service.mode !== 'oidc') {
        leaveCallback(intentPath)
        setPhase('ready')
        return
      }
      const result = await service.handleCallback(callbackUrl)
      if (result.ok) {
        leaveCallback(result.value.returnTo)
        setPhase('ready')
        return
      }
      leaveCallback(intentPath)
      if (result.error === 'login-required') {
        setPhase('login-required')
        return
      }
      if (result.error === 'missing-login-state') {
        // Reloaded callback: start over
        setPhase('ready')
        return
      }
      console.error('[auth] Login callback failed', result.detail)
      setPhase('failed')
    }
    void completeLogin()
  }, [callbackUrl, intentId, service])

  if (phase === 'callback') return <FullPageLoader />
  if (phase === 'login-required') {
    return <IntentMessageScreen message="sessionExpired" />
  }
  if (phase === 'failed') return <IntentMessageScreen message="failed" />
  // The token of the stack comes from the ID token of the SSO
  if (service.mode !== 'oidc') {
    return <IntentMessageScreen message="unavailable" />
  }
  return <IntentsRouter intentId={intentId} />
}

/** Puts the path the login was for in the address, without a history entry */
function leaveCallback(path: string): void {
  window.history.replaceState(null, '', path)
}

interface IntentsRouterProps {
  intentId: string
}

/** Created once the address is the intents page: the router reads it */
function IntentsRouter({ intentId }: IntentsRouterProps): ReactElement {
  const [router] = useState(() =>
    createBrowserRouter(
      createRoutesFromElements(
        <Route element={<RequireAuth loading={<FullPageLoader />} />}>
          <Route
            path="*"
            element={
              <JmapSessionProvider loading={<FullPageLoader />}>
                <IntentPage intentId={intentId} />
              </JmapSessionProvider>
            }
          />
        </Route>
      )
    )
  )

  return <RouterProvider router={router} />
}
