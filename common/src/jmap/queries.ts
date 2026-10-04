import { queryOptions } from '@tanstack/react-query'
import { CAPABILITIES, type JmapClient, type Session } from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

/** What the mail screens need from the JMAP session */
export interface JmapSessionInfo {
  session: Session
  /** Primary account of the mail capability */
  accountId: string
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
  return { session, accountId }
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
