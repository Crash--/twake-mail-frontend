import type { JmapClient, SearchSnippet } from 'jmap-client-ts'

import { hasSearchedWords } from '@common/features/search/queries'
import { settle } from '@common/jmap/settle'

import {
  byReceivedAt,
  EMAIL_LIST_PAGE_SIZE,
  EMAIL_LIST_PROPERTIES,
  orderByIds,
  THREAD_MEMBER_PROPERTIES,
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
 * Queries the loaded window of a list again (search results, conversations
 * of a mailbox), after changes the client cannot place: James has no
 * `Email/queryChanges`. The `Email/query` of the ids, by chunks of 256 in
 * one request (the loaded rows stay, and the scroll position with them),
 * then, when new ids appear, one request with the `Email/get` and `SearchSnippet/get` of the
 * new ids and, for conversations, the `Thread/get` of their threads and
 * the `Email/get` of their members. The emails already listed are kept as
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
    const calls: {
      current: {
        emails: PromiseLike<{ list: EmailListItemData[] }>
        snippets: PromiseLike<{ list: SearchSnippet[] }>
        members: PromiseLike<{ list: ThreadMember[] }> | null
      } | null
    } = { current: null }
    await client.requestSettled(builder => {
      const emails = builder.call('Email/get', {
        accountId,
        ids: missing,
        properties: [...EMAIL_LIST_PROPERTIES]
      })
      const snippets = builder.call('SearchSnippet/get', {
        accountId,
        filter: hasSearchedWords(filter) ? filter : null,
        emailIds: missing
      })
      // The members of the new conversations
      const threadsOfNew = collapseThreads
        ? builder.call('Thread/get', {
            accountId,
            '#ids': emails.ref('/list/*/threadId')
          })
        : null
      const members = threadsOfNew
        ? builder.call('Email/get', {
            accountId,
            '#ids': threadsOfNew.ref('/list/*/emailIds'),
            properties: [...THREAD_MEMBER_PROPERTIES]
          })
        : null
      calls.current = { emails, snippets, members }
      return [
        emails,
        snippets,
        ...(threadsOfNew && members ? [threadsOfNew, members] : [])
      ]
    })
    if (calls.current === null) throw new Error('The request was not built')
    const { members } = calls.current
    const [emails, found, membersResult] = await Promise.all([
      settle(calls.current.emails),
      settle(calls.current.snippets),
      members === null ? null : settle(members)
    ])
    if (!emails.ok) throw emails.error
    for (const email of orderByIds(emails.value.list, missing)) {
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
