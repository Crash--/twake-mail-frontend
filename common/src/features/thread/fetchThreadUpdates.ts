import type { JmapClient } from 'jmap-client-ts'

import { getInChunks } from '@common/jmap/maxObjectsInGet'

import {
  byReceivedAt,
  EMAIL_LIST_PROPERTIES,
  fetchThreadMembersInChunks,
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
 * alone (`patchThreadList`): the `Thread/get` of the threads and the
 * `Email/get` of the rows, then the `Email/get` of the members of the
 * threads, each in chunks of `maxObjectsInGet`
 */
export async function fetchThreadUpdates(
  client: JmapClient,
  accountId: string,
  { threadIds, rowIds }: ThreadUpdatesRequest
): Promise<ThreadUpdates> {
  const [found, rows] = await Promise.all([
    getInChunks(client, threadIds, (builder, chunk) =>
      builder.call('Thread/get', { accountId, ids: chunk })
    ),
    getInChunks(client, rowIds, (builder, chunk) =>
      builder.call('Email/get', {
        accountId,
        ids: chunk,
        properties: [...EMAIL_LIST_PROPERTIES]
      })
    )
  ])
  const members = await fetchThreadMembersInChunks(
    client,
    accountId,
    found.list.flatMap(thread => thread.emailIds)
  )
  const threads = new Map<string, ThreadMember[]>(
    threadIds.map(threadId => [threadId, []])
  )
  for (const member of members.list) {
    threads.get(member.threadId)?.push(member)
  }
  for (const list of threads.values()) list.sort(byReceivedAt)
  return {
    threads,
    rows: new Map(rows.list.map(row => [row.id, row]))
  }
}
