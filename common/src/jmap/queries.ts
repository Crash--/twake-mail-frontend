import { queryOptions } from '@tanstack/react-query'
import { CAPABILITIES, type JmapClient, type Session } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

/**
 * James extension giving access to shared and team mailboxes, with their
 * `namespace`: tmail-flutter sends it in every request when the session
 * has it
 */
export const SHARES_CAPABILITY = LINAGORA_CAPABILITIES.jamesShares

/** What the mail screens need from the JMAP session */
export interface JmapSessionInfo {
  session: Session
  /** Primary account of the mail capability */
  accountId: string
  /**
   * Capabilities to add to the `using` of the mail requests, besides the
   * ones of their methods (`extraCapabilities` of jmap-client-ts)
   */
  extraCapabilities: readonly string[]
}

export class NoMailAccountError extends Error {
  constructor(username: string) {
    super(`The JMAP session of ${username} has no primary mail account`)
    this.name = 'NoMailAccountError'
  }
}

export type SessionKey = readonly ['jmap', 'session']

export const jmapKeys = {
  session: (): SessionKey => ['jmap', 'session']
}

async function fetchSessionInfo(client: JmapClient): Promise<JmapSessionInfo> {
  const session = await client.getSession()
  const accountId = session.primaryAccounts[CAPABILITIES.mail]
  if (accountId === undefined) throw new NoMailAccountError(session.username)
  const extraCapabilities =
    SHARES_CAPABILITY in session.capabilities ? [SHARES_CAPABILITY] : []
  return { session, accountId, extraCapabilities }
}

/**
 * The JMAP session of the signed-in user. The client caches it: it is only
 * fetched again when a response says it changed.
 */
export function sessionQueryOptions(
  client: JmapClient
): QueryOptionsFor<JmapSessionInfo, SessionKey> {
  return queryOptions({
    queryKey: jmapKeys.session(),
    queryFn: () => fetchSessionInfo(client),
    staleTime: Infinity
  })
}
