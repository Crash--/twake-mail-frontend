import { useQueryClient } from '@tanstack/react-query'
import {
  JmapPushNotSupportedError,
  type WebSocketConstructor
} from 'jmap-client-ts'
import { useEffect, type ReactElement, type ReactNode } from 'react'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  invalidateOnStateChange,
  invalidatePushedData,
  PUSHED_DATA_TYPES
} from './invalidateOnPush'

/** Keeps idle connections open through proxies that close silent sockets */
const PING_INTERVAL_MS = 30_000

function logInvalidationError(error: unknown): void {
  console.error('[push] Cannot refresh the data', error)
}

export interface PushProviderProps {
  children: ReactNode
  /** WebSocket implementation, the browser's by default (tests) */
  WebSocket?: WebSocketConstructor
}

/**
 * Listens to the JMAP push channel (WebSocket) of the session and refetches
 * the mailboxes and emails the server says changed. The channel closes when
 * the session ends, as this provider unmounts with the signed-in screens.
 */
export function PushProvider({
  children,
  WebSocket
}: PushProviderProps): ReactElement {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const queryClient = useQueryClient()

  useEffect(() => {
    const push = client.connectWebSocket({
      dataTypes: PUSHED_DATA_TYPES,
      ping: { intervalMs: PING_INTERVAL_MS },
      ...(WebSocket ? { WebSocket } : {})
    })
    const unsubscribers = [
      push.on('stateChange', change => {
        invalidateOnStateChange(queryClient, accountId, change).catch(
          logInvalidationError
        )
      }),
      push.on('status', status => {
        if (status !== 'open') return
        invalidatePushedData(queryClient, accountId).catch(logInvalidationError)
      }),
      push.on('error', error => {
        if (error instanceof JmapPushNotSupportedError) {
          console.info('[push] No push from this server', error.message)
        } else {
          console.warn('[push] Push channel error', error)
        }
      })
    ]
    return () => {
      unsubscribers.forEach(unsubscribe => {
        unsubscribe()
      })
      push.close()
    }
  }, [client, accountId, queryClient, WebSocket])

  return <>{children}</>
}
