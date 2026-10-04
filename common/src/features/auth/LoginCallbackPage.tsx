import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { ErrorScreen } from '@common/components/ErrorScreen'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useI18n } from '@common/i18n/useI18n'

import { useAuthService } from './AuthProvider'
import type { OidcAuthService } from './types'

/**
 * `/callback`: the SSO comes back here with the authorization code.
 */
export function LoginCallbackPage(): ReactElement {
  const service = useAuthService()

  if (service.mode !== 'oidc') return <Navigate to="/" replace />

  return <OidcCallback service={service} />
}

function OidcCallback({ service }: { service: OidcAuthService }): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const hasRun = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // The code can be exchanged once only: React strict mode runs effects twice
    if (hasRun.current) return
    hasRun.current = true

    const completeLogin = async (): Promise<void> => {
      const result = await service.handleCallback(new URL(window.location.href))
      if (result.ok) {
        await navigate(result.value.returnTo, { replace: true })
        return
      }
      if (result.error === 'missing-login-state') {
        // Reloaded or bookmarked callback: start over
        await navigate('/', { replace: true })
        return
      }
      console.error('[auth] Login callback failed', result.detail)
      setFailed(true)
    }
    void completeLogin()
  }, [service, navigate])

  const handleReconnect = (): void => {
    void navigate('/', { replace: true })
  }

  if (failed) {
    return (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.reconnect')}
        onAction={handleReconnect}
        data-testid="callback-error"
      />
    )
  }

  return <FullPageLoader />
}
