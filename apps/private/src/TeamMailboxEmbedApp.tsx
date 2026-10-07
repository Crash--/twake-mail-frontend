import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createBrowserRouter, createRoutesFromElements } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { useAuthService } from '@common/features/auth/AuthProvider'
import type { SpaceBridge } from '@common/features/teamMailboxEmbed/spaceBridge'
import { TeamMailboxEmbedProvider } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import type { TeamMailboxEmbedTarget } from '@common/features/teamMailboxEmbed/teamMailboxEmbedPath'
import { useI18n } from '@common/i18n/useI18n'
import { TeamMailboxLoadingScreen } from '@common/layout/TeamMailboxLoadingScreen'

import { teamMailboxEmbedRouteElements } from './TeamMailboxEmbedRoutes'

export interface TeamMailboxEmbed {
  target: TeamMailboxEmbedTarget
  /**
   * The SSO came back to the callback page of the app (outside the base of
   * the facade) for a login started by the facade
   */
  callbackUrl: URL | null
}

type Phase = 'callback' | 'ready' | 'login-required' | 'failed'

export interface TeamMailboxEmbedAppProps {
  embed: TeamMailboxEmbed
  /** Null outside a frame of TwakeSpace */
  spaceBridge: SpaceBridge | null
}

/**
 * The facade of a team mailbox, for the Mail tab of a TwakeSpace space (ADR
 * 010 of twake-space-architecture). Its routes live under the base
 * `/embed/team-mailboxes/<address>`, so the screens of the webmail link
 * inside it; the login callback, outside that base, is handled here first.
 * In a frame, the logins are silent (`prompt=none`): when the SSO needs the
 * user, TwakeSpace is told and signs them in again.
 */
export function TeamMailboxEmbedApp({
  embed,
  spaceBridge
}: TeamMailboxEmbedAppProps): ReactElement {
  const { t } = useI18n()
  const service = useAuthService()
  const [phase, setPhase] = useState<Phase>(
    embed.callbackUrl === null ? 'ready' : 'callback'
  )
  const hasRun = useRef(false)

  useEffect(() => {
    const { callbackUrl } = embed
    // The code can be exchanged once only: React strict mode runs effects twice
    if (callbackUrl === null || hasRun.current) return
    hasRun.current = true

    const completeLogin = async (): Promise<void> => {
      if (service.mode !== 'oidc') {
        leaveCallback(embed.target.basename)
        setPhase('ready')
        return
      }
      const result = await service.handleCallback(callbackUrl)
      if (result.ok) {
        leaveCallback(result.value.returnTo)
        setPhase('ready')
        return
      }
      if (result.error === 'login-required') {
        leaveCallback(result.returnTo)
        spaceBridge?.notifyLoginRequired()
        setPhase('login-required')
        return
      }
      if (result.error === 'missing-login-state') {
        // Reloaded callback: start over
        leaveCallback(embed.target.basename)
        setPhase('ready')
        return
      }
      console.error('[auth] Login callback failed', result.detail)
      leaveCallback(embed.target.basename)
      setPhase('failed')
    }
    void completeLogin()
  }, [embed, service, spaceBridge])

  const handleRetry = (): void => {
    setPhase('ready')
  }

  if (phase === 'callback') return <TeamMailboxLoadingScreen />

  if (phase === 'login-required') {
    return (
      <ErrorScreen
        title={t('teamMailboxEmbed.sessionExpiredTitle')}
        description={t('teamMailboxEmbed.sessionExpiredDescription')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="team-mailbox-session-expired"
      />
    )
  }

  if (phase === 'failed') {
    return (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.reconnect')}
        onAction={handleRetry}
        data-testid="callback-error"
      />
    )
  }

  return (
    <TeamMailboxEmbedProvider rootId={embed.target.rootId}>
      <TeamMailboxRouter
        basename={embed.target.basename}
        spaceBridge={spaceBridge}
      />
    </TeamMailboxEmbedProvider>
  )
}

/** Puts the path the login was for in the address, without a history entry */
function leaveCallback(path: string): void {
  window.history.replaceState(null, '', path)
}

interface TeamMailboxRouterProps {
  basename: string
  spaceBridge: SpaceBridge | null
}

/** Created once the address is a path of the facade: the router reads it */
function TeamMailboxRouter({
  basename,
  spaceBridge
}: TeamMailboxRouterProps): ReactElement {
  const [router] = useState(() =>
    createBrowserRouter(
      createRoutesFromElements(teamMailboxEmbedRouteElements(spaceBridge)),
      { basename }
    )
  )

  useEffect(
    () =>
      spaceBridge?.syncHistory(path =>
        router.navigate(path, { replace: true })
      ),
    [router, spaceBridge]
  )

  return <RouterProvider router={router} />
}
