import type { JmapClient } from 'jmap-client-ts'

import { hasSearchedWords } from '@common/features/search/queries'
import { getInChunks } from '@common/jmap/maxObjectsInGet'
import { settle } from '@common/jmap/settle'

import {
  byReceivedAt,
  EMAIL_LIST_PAGE_SIZE,
  EMAIL_LIST_PROPERTIES,
  fetchThreadMembersInChunks,
  orderByIds,
  type EmailListData,
  type EmailListItemData,
  type EmailListPage,
  type EmailSnippet,
  type SearchRequest,
  type ThreadMember
} from './queries'

/** Most ids one `Email/query` returns: James caps `limit` at 256 */
export const QUERY_CHUNK_SIZE = 256

/**
 * Largest window queried again, in chunks of `QUERY_CHUNK_SIZE` in one
 * request (James answers 16 calls per request); beyond, the list starts
 * over
 */
export const MAX_REFRESHED_RESULTS = 8 * QUERY_CHUNK_SIZE

/**
 * The members of the threads `threadIds`: their `Thread/get`, then the
 * `Email/get` of their emails, each in chunks of `maxObjectsInGet`
 */
async function fetchConversationMembers(
  client: JmapClient,
  accountId: string,
  threadIds: readonly string[]
): Promise<{ list: ThreadMember[] }> {
  const found = await getInChunks(
    client,
    [...new Set(threadIds)],
    (builder, chunk) => builder.call('Thread/get', { accountId, ids: chunk })
  )
  return fetchThreadMembersInChunks(
    client,
    accountId,
    found.list.flatMap(thread => thread.emailIds)
  )
}

/**
 * Queries the loaded window of a list again (search results, conversations
 * of a mailbox), after changes the client cannot place: James has no
 * `Email/queryChanges`. The `Email/query` of the ids, by chunks of 256 in
 * one request (the loaded rows stay, and the scroll position with them),
 * then, when new ids appear, the `Email/get` and `SearchSnippet/get` of the
 * new ids and, for conversations, the `Thread/get` of their threads and the
 * `Email/get` of their members, each in chunks of `maxObjectsInGet`, as
 * tmail-flutter. The emails already listed are kept as
 * they are, with their members (push patched them). Null when the window
 * is too large.
 */
export async function refreshQueryList(
  client: JmapClient,
  accountId: string,
  { filter, sort, collapseThreads = false }: SearchRequest,
  data: EmailListData
): Promise<EmailListData | null> {
  const loaded = data.pages.flatMap(page => page.emails)
  const firstPage = data.pages[0]
  const lastPage = data.pages[data.pages.length - 1]
  if (firstPage === undefined || lastPage === undefined) return data
  const windowSize = Math.max(
    loaded.length,
    lastPage.position + lastPage.count,
    EMAIL_LIST_PAGE_SIZE
  )
  if (windowSize > MAX_REFRESHED_RESULTS) return null

  const chunks = await client.request(builder =>
    Array.from(
      { length: Math.ceil(windowSize / QUERY_CHUNK_SIZE) },
      (_, index) => {
        const position = index * QUERY_CHUNK_SIZE
        return builder.call('Email/query', {
          accountId,
          filter,
          sort: sort.length > 0 ? [...sort] : null,
          position,
          limit: Math.min(QUERY_CHUNK_SIZE, windowSize - position),
          collapseThreads
        })
      }
    )
  )
  const query = {
    ids: [...new Set(chunks.flatMap(chunk => chunk.ids))],
    total: chunks[0]?.total ?? null
  }
  const known = new Map(loaded.map(email => [email.id, email]))
  const missing = query.ids.filter(id => !known.has(id))
  const snippets = new Map<string, EmailSnippet>(
    data.pages.flatMap(page => Object.entries(page.snippets ?? {}))
  )
  const threads = new Map<string, readonly ThreadMember[]>(
    data.pages.flatMap(page => Object.entries(page.threads ?? {}))
  )
  if (missing.length > 0) {
    // The new ids (up to MAX_REFRESHED_RESULTS) and their snippets, in
    // chunks of `maxObjectsInGet`
    const [listed, found] = await Promise.all([
      getInChunks(client, missing, (builder, chunk) =>
        builder.call('Email/get', {
          accountId,
          ids: chunk,
          properties: [...EMAIL_LIST_PROPERTIES]
        })
      ),
      settle(
        getInChunks(client, missing, (builder, chunk) =>
          builder.call('SearchSnippet/get', {
            accountId,
            filter: hasSearchedWords(filter) ? filter : null,
            emailIds: chunk
          })
        )
      )
    ])
    // The members of the new conversations, optional
    const membersResult = collapseThreads
      ? await settle(
          fetchConversationMembers(
            client,
            accountId,
            listed.list.map(email => email.threadId)
          )
        )
      : null
    for (const email of orderByIds(listed.list, missing)) {
      known.set(email.id, email)
    }
    if (found.ok) {
      for (const { emailId, subject, preview } of found.value.list) {
        snippets.set(emailId, { subject, preview })
      }
    }
    if (membersResult?.ok) {
      const byThread = new Map<string, ThreadMember[]>()
      for (const member of membersResult.value.list) {
        byThread.set(member.threadId, [
          ...(byThread.get(member.threadId) ?? []),
          member
        ])
      }
      for (const [threadId, list] of byThread) {
        threads.set(threadId, [...list].sort(byReceivedAt))
      }
    }
  }

  const emails = query.ids.flatMap((id): EmailListItemData[] => {
    const email = known.get(id)
    return email ? [email] : []
  })
  const total = query.total ?? null
  const isComplete = query.ids.length < windowSize
  // Fetched emails may be newer: the window keeps the state it was patched
  // to, and the next changes bring them again, harmlessly
  const state = firstPage.state
  const pageCount = Math.max(1, Math.ceil(emails.length / EMAIL_LIST_PAGE_SIZE))
  const pages = Array.from({ length: pageCount }, (_, index): EmailListPage => {
    const position = index * EMAIL_LIST_PAGE_SIZE
    const slice = emails.slice(position, position + EMAIL_LIST_PAGE_SIZE)
    const page: EmailListPage = {
      emails: slice,
      position,
      count: slice.length,
      total,
      isLast: index === pageCount - 1 && isComplete,
      state,
      snippets: Object.fromEntries(
        slice.flatMap(email => {
          const snippet = snippets.get(email.id)
          return snippet ? [[email.id, snippet]] : []
        })
      )
    }
    return collapseThreads
      ? {
          ...page,
          threads: Object.fromEntries(
            slice.map(email => [
              email.threadId,
              threads.get(email.threadId) ?? [email]
            ])
          )
        }
      : page
  })
  return { pages, pageParams: pages.map(page => page.position) }
}
