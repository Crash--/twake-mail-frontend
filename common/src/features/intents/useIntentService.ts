import { Intents, type IntentService } from 'cozy-interapp'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import {
  useAuthService,
  useAuthState
} from '@common/features/auth/AuthProvider'
import type { OidcAuthService } from '@common/features/auth/types'
import {
  exchangeDriveToken,
  resolveDriveUrl,
  type DriveResult
} from '@common/features/drive/driveApi'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { CozyStackError, makeIntentsFetch } from './intentsFetch'

/**
 * Why the page cannot serve the intent, before the service exists (nothing
 * can be told to the client then: the page says it):
 * - `unavailable`: not in a frame, no OIDC session, no cozy-stack address,
 *   or the stack refused the token
 * - `forbidden`: the stack does not let this app read the intent (its
 *   manifest or the token exchange are not set up)
 * - `failed`: the stack or the client did not answer
 */
export type IntentServiceError = 'unavailable' | 'forbidden' | 'failed'

/**
 * How long the client has to answer the `ready` message: an origin that is
 * not the one the stack knows for it never gets it
 */
export const CLIENT_ANSWER_TIMEOUT_MS = 30_000

export type IntentServiceState =
  | { status: 'loading' }
  | { status: 'ready'; service: IntentService }
  | { status: 'failed'; error: IntentServiceError }

/** The ID token traded for a token of the stack, once more after a refresh */
async function exchangeStackToken(
  service: OidcAuthService,
  cozyStackUrl: string
): Promise<DriveResult<string>> {
  const idToken = service.getIdToken()
  const first =
    idToken === null
      ? ({ ok: false, error: 'token' } as const)
      : await exchangeDriveToken(cozyStackUrl, idToken)
  if (first.ok || first.error !== 'token') return first
  // An ID token past its lifetime: renewed once
  if (!(await service.refresh())) return first
  const renewed = service.getIdToken()
  return renewed === null ? first : exchangeDriveToken(cozyStackUrl, renewed)
}

/** The value, or null once the delay is over */
async function withTimeout<T>(
  promise: Promise<T>,
  delayMs: number
): Promise<T | null> {
  let timer = 0
  const timeout = new Promise<null>(resolve => {
    timer = window.setTimeout(() => {
      resolve(null)
    }, delayMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * The cozy-interapp service of the intent the page is for: trades the ID
 * token for a token of the cozy-stack of the user, reads the intent, then
 * waits for the data of the client (the app that framed the page). Started
 * once: a second handshake would answer the client twice.
 */
export function useIntentService(intentId: string): IntentServiceState {
  const config = useAppConfig()
  const service = useAuthService()
  const authState = useAuthState()
  const { session } = useJmapSession()
  const [state, setState] = useState<IntentServiceState>({
    status: 'loading'
  })
  const startedRef = useRef(false)
  const workplaceFqdn =
    authState.status === 'authenticated' ? authState.user.workplaceFqdn : null
  const cozyStackUrl = useMemo(
    () =>
      resolveDriveUrl(config?.cozyStackUrl ?? null, {
        username: session.username,
        workplaceFqdn,
        workplaceFqdnFallback: config?.workplaceFqdnFallback ?? null
      }),
    [
      config?.cozyStackUrl,
      config?.workplaceFqdnFallback,
      session.username,
      workplaceFqdn
    ]
  )
  // Out of a frame there is no client to answer
  const isAvailable =
    window.parent !== window && service.mode === 'oidc' && cozyStackUrl !== null

  useEffect(() => {
    if (
      startedRef.current ||
      window.parent === window ||
      service.mode !== 'oidc' ||
      cozyStackUrl === null
    ) {
      return
    }
    startedRef.current = true

    const start = async (): Promise<void> => {
      const token = await exchangeStackToken(service, cozyStackUrl)
      if (!token.ok) {
        setState({
          status: 'failed',
          error: token.error === 'network' ? 'failed' : 'unavailable'
        })
        return
      }
      const intents = new Intents({
        fetch: makeIntentsFetch(cozyStackUrl, token.value)
      })
      try {
        // The id given: cozy-interapp would read the first parameter only
        const intentService = await withTimeout(
          intents.createService(intentId, window),
          CLIENT_ANSWER_TIMEOUT_MS
        )
        setState(
          intentService === null
            ? { status: 'failed', error: 'failed' }
            : { status: 'ready', service: intentService }
        )
      } catch (error: unknown) {
        console.error('[intents] Cannot start the service', error)
        setState({
          status: 'failed',
          error:
            error instanceof CozyStackError && error.status === 403
              ? 'forbidden'
              : 'failed'
        })
      }
    }
    start().catch((error: unknown) => {
      console.error('[intents] Cannot start the service', error)
      setState({ status: 'failed', error: 'failed' })
    })
  }, [service, cozyStackUrl, intentId])

  return isAvailable ? state : { status: 'failed', error: 'unavailable' }
}
