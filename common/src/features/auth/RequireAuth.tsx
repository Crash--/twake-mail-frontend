import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useI18n } from '@common/i18n/useI18n'

import { useAuthService, useAuthState } from './AuthProvider'

export interface LoginRouteState {
  returnTo: string
}

export interface RequireAuthProps {
  /** Shown while the SSO login starts, a full-page spinner by default */
  loading?: ReactNode
}

/**
 * Renders the nested routes for a signed-in user. Otherwise sends the user
 * to the SSO (OIDC mode) or to the login form (basic mode), remembering
 * where to come back, unless the user signed out: the next session, maybe
 * someone else's, opens on the Inbox, without the address of the previous
 * one (a search, an email).
 */
export function RequireAuth({
  loading = <FullPageLoader />
}: RequireAuthProps): ReactElement {
  const { t } = useI18n()
  const service = useAuthService()
  const state = useAuthState()
  const location = useLocation()
  const [loginError, setLoginError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  const mustLeaveAddress =
    state.status === 'anonymous' && state.signedOut === true && returnTo !== '/'
  const mustStartSsoLogin =
    state.status === 'anonymous' && service.mode === 'oidc' && !mustLeaveAddress

  useEffect(() => {
    if (!mustStartSsoLogin) return

    const startSsoLogin = async (): Promise<void> => {
      // The SSO comes back to the page itself: the address of the browser
      const result = await service.startLogin()
      if (!result.ok) {
        console.error('[auth] Cannot reach the SSO', result.error)
        setLoginError(result.error)
      }
    }
    void startSsoLogin()
  }, [mustStartSsoLogin, service, attempt])

  const handleRetry = (): void => {
    setLoginError(null)
    setAttempt(previous => previous + 1)
  }

  if (state.status === 'authenticated') return <Outlet />

  // Another tab may hand its session over
  if (state.status === 'restoring') return <>{loading}</>

  if (mustLeaveAddress) return <Navigate to="/" replace />

  if (service.mode === 'basic') {
    const loginState: LoginRouteState = { returnTo }
    return <Navigate to="/login" replace state={loginState} />
  }

  if (loginError !== null) {
    return (
      <ErrorScreen
        title={t('login.connectionError')}
        headingLevel="h1"
        description={t('common.unknownError')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="sso-error"
      />
    )
  }

  return <>{loading}</>
}
