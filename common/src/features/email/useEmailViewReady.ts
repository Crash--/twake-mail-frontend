import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useThreadPreference } from '@common/features/settings/threadPreference'
import { conversationQueryOptions } from '@common/features/thread/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { emailQueryOptions } from './queries'

/**
 * How long opening an email waits for its data. Beyond it the email opens
 * at once, without the view transition: animating towards a skeleton and
 * then swapping it for the content is worse than no animation.
 */
export const EMAIL_VIEW_READY_TIMEOUT_MS = 500

/**
 * Loads what the reading view of an email shows (the email, and its
 * conversation with the "Thread" setting) before it opens, so that the view
 * transition of the navigation ends on the content, not on a skeleton.
 * Resolves true when the data is there, false when it took longer than
 * `EMAIL_VIEW_READY_TIMEOUT_MS` or failed (the view then shows its own
 * loading or error state).
 */
export function useEmailViewReady(): (
  emailId: string,
  threadId: string | null
) => Promise<boolean> {
  const queryClient = useQueryClient()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { isEnabled: showsConversation } = useThreadPreference()

  return useCallback(
    async (emailId, threadId) => {
      const loads: Promise<unknown>[] = [
        queryClient.query({
          ...emailQueryOptions(client, accountId, emailId),
          staleTime: 'static'
        })
      ]
      if (showsConversation && threadId !== null) {
        loads.push(
          queryClient.query({
            ...conversationQueryOptions(client, accountId, threadId, emailId),
            staleTime: 'static'
          })
        )
      }
      let timer: number | undefined
      const timeout = new Promise<boolean>(resolve => {
        timer = window.setTimeout(() => {
          resolve(false)
        }, EMAIL_VIEW_READY_TIMEOUT_MS)
      })
      const loaded = Promise.all(loads).then(
        () => true,
        () => false
      )
      const isReady = await Promise.race([loaded, timeout])
      window.clearTimeout(timer)
      return isReady
    },
    [queryClient, client, accountId, showsConversation]
  )
}
