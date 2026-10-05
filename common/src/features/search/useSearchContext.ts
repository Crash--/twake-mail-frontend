import { useMemo, useState } from 'react'

import { findTrashAndSpamIds } from '@common/features/mailbox/mailboxTree'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'

import { formatDay, type SearchContext } from './searchFilter'

/**
 * What a search filter needs to become a JMAP filter: the trash (a team
 * mailbox's too) and spam mailboxes, left out by default, and today (relative date ranges count
 * from the day the screen opened, which keeps the query stable). Null
 * until the mailboxes are known, so that the first query is the right one.
 */
export function useSearchContext(): SearchContext | null {
  const mailboxes = useMailboxes()
  const [today] = useState(() => formatDay(new Date()))
  const key = findTrashAndSpamIds(mailboxes.data ?? [])
    .sort()
    .join('\n')
  const isLoaded = mailboxes.isSuccess
  return useMemo(
    () =>
      isLoaded
        ? { trashAndSpamIds: key === '' ? [] : key.split('\n'), today }
        : null,
    [isLoaded, key, today]
  )
}
