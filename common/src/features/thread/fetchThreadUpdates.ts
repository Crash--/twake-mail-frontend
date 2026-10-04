import type { JmapClient } from 'jmap-client-ts'

import {
  byReceivedAt,
  EMAIL_LIST_PROPERTIES,
  THREAD_MEMBER_PROPERTIES,
  type EmailListItemData,
  type ThreadMember
} from './queries'

export interface ThreadUpdatesRequest {
  /** Threads whose members to read */
  threadIds: readonly string[]
  /** Emails whose list properties to read */
  rowIds: readonly string[]
}

export interface ThreadUpdates {
  /** The members of each thread asked for, the oldest first */
  threads: Map<string, ThreadMember[]>
  rows: Map<string, EmailListItemData>
}

/**
 * What lists of conversations need to place changes they cannot place
 * alone (`patchThreadList`), in one JMAP request: the `Thread/get` of the
 * threads and the `Email/get` of their members through a back-reference,
 * and the `Email/get` of the rows.
 */
export async function fetchThreadUpdates(
  client: JmapClient,
  accountId: string,
  { threadIds, rowIds }: ThreadUpdatesRequest
): Promise<ThreadUpdates> {
  const [, members, rows] = await client.request(builder => {
    const threads = builder.call('Thread/get', {
      accountId,
      ids: [...threadIds]
    })
    return [
      threads,
      builder.call('Email/get', {
        accountId,
        '#ids': threads.ref('/list/*/emailIds'),
        properties: [...THREAD_MEMBER_PROPERTIES]
      }),
      builder.call('Email/get', {
        accountId,
        ids: [...rowIds],
        properties: [...EMAIL_LIST_PROPERTIES]
      })
    ]
  })
  const threads = new Map<string, ThreadMember[]>(
    threadIds.map(threadId => [threadId, []])
  )
  for (const member of members.list) threads.get(member.threadId)?.push(member)
  for (const list of threads.values()) list.sort(byReceivedAt)
  return {
    threads,
    rows: new Map(rows.list.map(row => [row.id, row]))
  }
}
