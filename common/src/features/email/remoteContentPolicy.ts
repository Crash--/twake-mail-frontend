import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useShowsRemoteImages } from '@common/features/settings/serverSettings'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { readRemoteContentConsent } from './remoteContentConsent'
import { isSameDomain, isTrustedSender } from './trustedSenders'

export interface RemoteContentGrounds {
  /** "Show remote images" is on in the preferences */
  isAlwaysShown: boolean
  /** The user clicked "Show" on this email */
  isConsented: boolean
  /** The user chose to always show the remote content of its sender */
  isTrustedSender: boolean
  senderEmail: string | null
  userEmail: string
}

/**
 * Whether the remote content (images, backgrounds, fonts) of an email shows
 * without asking: the user wants it for every email, or for this one, or
 * for its sender, or the sender is of the user's domain (for now: the From
 * of an email can be forged)
 */
export function allowsRemoteContent({
  isAlwaysShown,
  isConsented,
  isTrustedSender,
  senderEmail,
  userEmail
}: RemoteContentGrounds): boolean {
  return (
    isAlwaysShown ||
    isConsented ||
    isTrustedSender ||
    (senderEmail !== null && isSameDomain(senderEmail, userEmail))
  )
}

/** Whether the remote content of an email shows, as the reader decides */
export type RemoteContentPolicy = (email: {
  id: string
  senderEmail: string | null
}) => boolean

/**
 * The same rule outside the reading view (printing, quoting in a reply),
 * as the user last chose it
 */
export function useRemoteContentPolicy(): RemoteContentPolicy {
  const queryClient = useQueryClient()
  const { accountId, session } = useJmapSession()
  const isAlwaysShown = useShowsRemoteImages()

  return useCallback(
    ({ id, senderEmail }) =>
      allowsRemoteContent({
        isAlwaysShown,
        isConsented: readRemoteContentConsent(queryClient, accountId, id),
        isTrustedSender: senderEmail !== null && isTrustedSender(senderEmail),
        senderEmail,
        userEmail: session.username
      }),
    [queryClient, accountId, session.username, isAlwaysShown]
  )
}
