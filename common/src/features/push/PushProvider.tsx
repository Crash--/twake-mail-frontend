import { useQueryClient } from '@tanstack/react-query'
import {
  JmapPushNotSupportedError,
  type WebSocketConstructor
} from 'jmap-client-ts'
import { useEffect, type ReactElement, type ReactNode } from 'react'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { createPushSync, SYNCED_TYPES } from './pushSync'

/** Keeps idle connections open through proxies that close silent sockets */
const PING_INTERVAL_MS = 30_000

export interface PushProviderProps {
  children: ReactNode
  /** WebSocket implementation, the browser's by default (tests) */
  WebSocket?: WebSocketConstructor
}

/**
 * Listens to the JMAP push channel (WebSocket) of the session and brings the
 * cached mailboxes and emails up to the states the server pushes, from their
 * changes (`pushSync`). After a reconnection, it catches up the changes made
 * while the channel was down. The channel closes when the session ends, as
 * this provider unmounts with the signed-in screens.
 */
export function PushProvider({
  children,
  WebSocket
}: PushProviderProps): ReactElement {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const queryClient = useQueryClient()

  useEffect(() => {
    const sync = createPushSync(queryClient, client, accountId)
    const push = client.connectWebSocket({
      dataTypes: [...SYNCED_TYPES],
      ping: { intervalMs: PING_INTERVAL_MS },
      ...(WebSocket ? { WebSocket } : {})
    })
    // The data just loaded is up to date when the channel first opens
    let hasBeenOpen = false
    const unsubscribers = [
      push.on('stateChange', change => {
        const states = change.changed[accountId]
        if (states) sync.stateChanged(states)
      }),
      push.on('status', status => {
        if (status !== 'open') return
        if (hasBeenOpen) sync.catchUp()
        hasBeenOpen = true
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
      sync.close()
    }
  }, [client, accountId, queryClient, WebSocket])

  return <>{children}</>
}
