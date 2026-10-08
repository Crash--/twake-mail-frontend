import { useQueryClient } from '@tanstack/react-query'
import {
  JmapPushNotSupportedError,
  type WebSocketConstructor
} from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

import { DEFAULT_STALE_TIME } from '@common/app/queryClient'
import { emailKeys } from '@common/features/email/queries'
import { syncLabels } from '@common/features/labels/queries'
import { quotaKeys } from '@common/features/quota/quota'
import {
  mailboxKeys,
  type MailboxListData
} from '@common/features/mailbox/queries'
import { createNewMailWatcher } from '@common/features/newMail/newMailWatcher'
import { useNewMailAlert } from '@common/features/newMail/useNewMailAlert'
import { threadKeys } from '@common/features/thread/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { fetchCurrentStates } from './fetchChanges'
import { createPushSync, SYNCED_TYPES } from './pushSync'

/** Keeps idle connections open through proxies that close silent sockets */
const PING_INTERVAL_MS = 30_000

export interface PushProviderProps {
  children: ReactNode
  /** WebSocket implementation, the browser's by default (tests) */
  WebSocket?: WebSocketConstructor
  /**
   * Plays the sound and shows the notifications of the emails reaching the
   * Inbox, as the user chose (`useNewMailAlert`)
   */
  alertsNewEmails?: boolean
}

/**
 * Listens to the JMAP push channel (WebSocket) of the session and brings the
 * cached mailboxes and emails up to the states the server pushes, from their
 * changes (`pushSync`). While the channel is open they never go stale; once
 * it drops they do after `DEFAULT_STALE_TIME` again. When it first opens,
 * the changes made since the first loads are caught up, as after a
 * reconnection those made while it was down, as when the browser comes back
 * online (no refetch of everything: the changes are caught up). The channel closes when the session ends, as
 * this provider unmounts with the signed-in screens.
 */
export function PushProvider({
  children,
  WebSocket,
  alertsNewEmails = false
}: PushProviderProps): ReactElement {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const queryClient = useQueryClient()
  const alert = useNewMailAlert(accountId)
  const alertRef = useRef(alert)
  useEffect(() => {
    alertRef.current = alert
  })

  useEffect(() => {
    const sync = createPushSync(queryClient, client, accountId)
    const newMail = alertsNewEmails
      ? createNewMailWatcher(
          client,
          accountId,
          () =>
            queryClient
              .getQueryData<MailboxListData>(mailboxKeys.list(accountId))
              ?.list.find(mailbox => mailbox.role === 'inbox')?.id ?? null,
          emails => {
            alertRef.current(emails)
          }
        )
      : null
    // What arrived before the channel (re)opened is not new: the watcher
    // starts from the current state
    const resetNewMail = (): void => {
      if (newMail === null) return
      newMail.reset(null)
      fetchCurrentStates(client, accountId)
        .then(states => {
          newMail.reset(states.Email)
        })
        .catch((error: unknown) => {
          console.warn('[push] Cannot read the current states', error)
        })
    }
    const hasLabels = client.hasCapability(LINAGORA_CAPABILITIES.labels)
    const push = client.connectWebSocket({
      dataTypes: hasLabels ? [...SYNCED_TYPES, 'Label'] : [...SYNCED_TYPES],
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
    // Back online, the channel is not open yet and the lists would count as
    // stale: TanStack would then refetch all of them. The changes made while
    // offline are caught up from the cache states instead (`catchUp`)
    for (const queryKey of syncedKeys) {
      queryClient.setQueryDefaults(queryKey, {
        staleTime,
        refetchOnReconnect: false
      })
    }
    // The reopening of the channel asks for it too: requests made while a
    // synchronization runs are merged (`pushSync`)
    const handleOnline = (): void => {
      sync.catchUp()
      if (hasLabels) void syncLabels(client, queryClient, accountId, null)
    }
    window.addEventListener('online', handleOnline)
    // Changes made between the first loads and the first opening of the
    // channel are pushed to nobody: the current states tell whether the
    // cache is behind, as a push would, and the lists landing after them
    // catch up (`pushSync`). A reopening catches up from the cache states
    let hasBeenOpen = false
    const unsubscribers = [
      push.on('stateChange', change => {
        const states = change.changed[accountId]
        if (states) sync.stateChanged(states)
        if (states?.Email !== undefined) newMail?.pushed(states.Email)
        if (states?.Email !== undefined) {
          // Emails in or out: the storage used changed
          void queryClient.invalidateQueries({
            queryKey: quotaKeys.all(accountId)
          })
        }
        const labelState = states?.Label
        if (labelState !== undefined) {
          void syncLabels(client, queryClient, accountId, labelState)
        }
      }),
      push.on('status', status => {
        isOpen = status === 'open'
        if (status !== 'open') return
        if (hasBeenOpen) {
          sync.catchUp()
          resetNewMail()
          if (hasLabels) void syncLabels(client, queryClient, accountId, null)
        } else {
          fetchCurrentStates(client, accountId)
            .then(states => {
              sync.stateChanged({ ...states })
              newMail?.reset(states.Email)
            })
            .catch((error: unknown) => {
              console.warn('[push] Cannot read the current states', error)
            })
        }
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
      window.removeEventListener('online', handleOnline)
      unsubscribers.forEach(unsubscribe => {
        unsubscribe()
      })
      push.close()
      sync.close()
      newMail?.close()
      for (const queryKey of syncedKeys) {
        queryClient.setQueryDefaults(queryKey, {
          staleTime: DEFAULT_STALE_TIME,
          refetchOnReconnect: true
        })
      }
    }
  }, [client, accountId, queryClient, WebSocket, alertsNewEmails])

  return <>{children}</>
}
