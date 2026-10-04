import type { QueryClient } from '@tanstack/react-query'
import type { StateChange } from 'jmap-client-ts'

import { emailKeys } from '@common/features/email/queries'
import { mailboxKeys } from '@common/features/mailbox/queries'
import { threadKeys } from '@common/features/thread/queries'

/** The JMAP data types the app follows over push */
export const PUSHED_DATA_TYPES: readonly string[] = ['Email', 'Mailbox']

/**
 * Refetches what a push state change makes stale: the mailboxes when a
 * Mailbox changed, the email lists and the opened email when an Email did.
 *
 * TODO: fetch only the changes (`Mailbox/changes`, `Email/changes`,
 * `Email/queryChanges`) from the states the cache holds.
 */
export async function invalidateOnStateChange(
  queryClient: QueryClient,
  accountId: string,
  change: StateChange
): Promise<void> {
  const changed = change.changed[accountId]
  if (!changed) return
  const invalidations: Promise<void>[] = []
  if ('Mailbox' in changed) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: mailboxKeys.all(accountId) })
    )
  }
  if ('Email' in changed) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: threadKeys.all(accountId) }),
      queryClient.invalidateQueries({ queryKey: emailKeys.all(accountId) })
    )
  }
  await Promise.all(invalidations)
}

/**
 * Refetches everything push keeps up to date: changes made while the push
 * channel was not open yet, or down, were not notified.
 */
export async function invalidatePushedData(
  queryClient: QueryClient,
  accountId: string
): Promise<void> {
  await Promise.all(
    [
      mailboxKeys.all(accountId),
      threadKeys.all(accountId),
      emailKeys.all(accountId)
    ].map(queryKey => queryClient.invalidateQueries({ queryKey }))
  )
}
