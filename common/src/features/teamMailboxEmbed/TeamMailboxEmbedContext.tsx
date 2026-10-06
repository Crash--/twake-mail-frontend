import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'

import { findTeamMailboxRoot } from './teamMailbox'

const TeamMailboxEmbedContext = createContext<string | null>(null)

export interface TeamMailboxEmbedProviderProps {
  /** The id of the root folder of the team mailbox the facade shows */
  rootId: string
  children: ReactNode
}

/**
 * Marks the screens below as the facade of one team mailbox
 * (`/embed/team-mailboxes/<id>`): the fallbacks lead to its Inbox, never
 * to the folders of the user.
 */
export function TeamMailboxEmbedProvider({
  rootId,
  children
}: TeamMailboxEmbedProviderProps): ReactElement {
  return (
    <TeamMailboxEmbedContext.Provider value={rootId}>
      {children}
    </TeamMailboxEmbedContext.Provider>
  )
}

/**
 * The id of the root of the team mailbox of the facade, null in the webmail.
 * Not to be mixed up with `useIsEmbedded` (Twake Workplace, the whole
 * webmail).
 */
export function useTeamMailboxEmbed(): string | null {
  return useContext(TeamMailboxEmbedContext)
}

/**
 * The root of the team mailbox of the facade, null in the webmail, while
 * the folders load, and when the user has no access to it
 */
export function useTeamMailboxRoot(): MailboxSummary | null {
  const rootId = useTeamMailboxEmbed()
  const query = useMailboxes()
  if (rootId === null || query.data === undefined) return null
  return findTeamMailboxRoot(query.data, rootId)
}
