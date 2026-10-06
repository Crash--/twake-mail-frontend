import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

const TeamMailboxEmbedContext = createContext<string | null>(null)

export interface TeamMailboxEmbedProviderProps {
  /** The address of the team mailbox the facade shows, lowercased */
  address: string
  children: ReactNode
}

/**
 * Marks the screens below as the facade of one team mailbox
 * (`/embed/team-mailboxes/<address>`): the fallbacks lead to its Inbox, never
 * to the folders of the user.
 */
export function TeamMailboxEmbedProvider({
  address,
  children
}: TeamMailboxEmbedProviderProps): ReactElement {
  return (
    <TeamMailboxEmbedContext.Provider value={address}>
      {children}
    </TeamMailboxEmbedContext.Provider>
  )
}

/**
 * The address of the team mailbox of the facade, null in the webmail. Not to
 * be mixed up with `useIsEmbedded` (Twake Workplace, the whole webmail).
 */
export function useTeamMailboxEmbed(): string | null {
  return useContext(TeamMailboxEmbedContext)
}
