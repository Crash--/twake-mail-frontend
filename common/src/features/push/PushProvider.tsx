import { useQueryClient } from '@tanstack/react-query'
import {
  JmapPushNotSupportedError,
  type WebSocketConstructor
} from 'jmap-client-ts'
import { useEffect, type ReactElement, type ReactNode } from 'react'

import { DEFAULT_STALE_TIME } from '@common/app/queryClient'
import { emailKeys } from '@common/features/email/queries'
import { mailboxKeys } from '@common/features/mailbox/queries'
import { threadKeys } from '@common/features/thread/queries'
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
 * changes (`pushSync`). While the channel is open they never go stale; once
 * it drops they do after `DEFAULT_STALE_TIME` again, and after a
 * reconnection the changes made while it was down are caught up. The channel closes when the session ends, as
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
    // While the channel is open, push keeps the mailboxes, the lists and
    // the open emails up to date: no refetch when they show again
    let isOpen = false
    const staleTime = (): number => (isOpen ? Infinity : DEFAULT_STALE_TIME)
    const syncedKeys = [
      mailboxKeys.all(accountId),
      threadKeys.all(accountId),
      emailKeys.all(accountId)
    ]
    for (const queryKey of syncedKeys) {
      queryClient.setQueryDefaults(queryKey, { staleTime })
    }
    // The data just loaded is up to date when the channel first opens
    let hasBeenOpen = false
    const unsubscribers = [
      push.on('stateChange', change => {
        const states = change.changed[accountId]
        if (states) sync.stateChanged(states)
      }),
      push.on('status', status => {
        isOpen = status === 'open'
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
      for (const queryKey of syncedKeys) {
        queryClient.setQueryDefaults(queryKey, {
          staleTime: DEFAULT_STALE_TIME
        })
      }
    }
  }, [client, accountId, queryClient, WebSocket])

  return <>{children}</>
}
