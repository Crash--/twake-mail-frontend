import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useI18n } from '@common/i18n/useI18n'

import { useAuthService, useAuthState } from './AuthProvider'

export interface LoginRouteState {
  returnTo: string
}

/**
 * Renders the nested routes for a signed-in user. Otherwise sends the user
 * to the SSO (OIDC mode) or to the login form (basic mode), remembering
 * where to come back.
 */
export function RequireAuth(): ReactElement {
  const { t } = useI18n()
  const service = useAuthService()
  const state = useAuthState()
  const location = useLocation()
  const [loginError, setLoginError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  const mustStartSsoLogin =
    state.status === 'anonymous' && service.mode === 'oidc'

  useEffect(() => {
    if (!mustStartSsoLogin) return

    const startSsoLogin = async (): Promise<void> => {
      const result = await service.startLogin(returnTo)
      if (!result.ok) {
        console.error('[auth] Cannot reach the SSO', result.error)
        setLoginError(result.error)
      }
    }
    void startSsoLogin()
    // returnTo is read once per attempt: the location does not change
    // while the browser leaves for the SSO
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustStartSsoLogin, service, attempt])

  const handleRetry = (): void => {
    setLoginError(null)
    setAttempt(previous => previous + 1)
  }

  if (state.status === 'authenticated') return <Outlet />

  if (service.mode === 'basic') {
    const loginState: LoginRouteState = { returnTo }
    return <Navigate to="/login" replace state={loginState} />
  }

  if (loginError !== null) {
    return (
      <ErrorScreen
        title={t('login.connectionError')}
        description={t('common.unknownError')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="sso-error"
      />
    )
  }

  return <FullPageLoader />
}
