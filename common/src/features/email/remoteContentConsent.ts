import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useJmapSession } from '@common/jmap/JmapSessionProvider'

type RemoteContentConsentKey = readonly ['remoteContentConsent', string, string]

const remoteContentConsentKey = (
  accountId: string,
  emailId: string
): RemoteContentConsentKey => ['remoteContentConsent', accountId, emailId]

/**
 * Whether the user chose to show the remote content of an email, and the
 * setter. The choice is asked once per email (issue #338): it lives in the
 * query cache, not in the state of the body, so that a reading view that
 * mounts again (resizing the window switches the layout) does not ask
 * again. It goes away with the session, as the rest of the cache.
 */
export function useRemoteContentConsent(
  emailId: string
): [boolean, () => void] {
  const queryClient = useQueryClient()
  const { accountId } = useJmapSession()
  const { data: isShown } = useQuery({
    queryKey: remoteContentConsentKey(accountId, emailId),
    queryFn: ({ queryKey }): boolean =>
      queryClient.getQueryData<boolean>(queryKey) ?? false,
    initialData: false,
    staleTime: 'static',
    gcTime: Infinity
  })
  const show = useCallback((): void => {
    queryClient.setQueryData<boolean>(
      remoteContentConsentKey(accountId, emailId),
      true
    )
  }, [queryClient, accountId, emailId])
  return [isShown, show]
}
