import { useMemo, useState } from 'react'

import {
  findTeamFolderIds,
  findTrashAndSpamIds
} from '@common/features/mailbox/mailboxTree'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'

import { formatDay, type SearchContext } from './searchFilter'

/**
 * What a search filter needs to become a JMAP filter: the trash (a team
 * mailbox's too) and spam mailboxes, left out by default, the folders of
 * each team mailbox, searched when its root is picked, and today (relative
 * date ranges count from the day the screen opened, which keeps the query
 * stable). Null until the mailboxes are known, so that the first query is
 * the right one.
 */
export function useSearchContext(): SearchContext | null {
  const mailboxes = useMailboxes()
  const [today] = useState(() => formatDay(new Date()))
  const key = findTrashAndSpamIds(mailboxes.data ?? [])
    .sort()
    .join('\n')
  // The query shares the structure of unchanged data: a stable reference
  const teamFolderIds = useMemo(
    () => findTeamFolderIds(mailboxes.data ?? []),
    [mailboxes.data]
  )
  const isLoaded = mailboxes.isSuccess
  return useMemo(
    () =>
      isLoaded
        ? {
            trashAndSpamIds: key === '' ? [] : key.split('\n'),
            teamFolderIds,
            today
          }
        : null,
    [isLoaded, key, teamFolderIds, today]
  )
}
