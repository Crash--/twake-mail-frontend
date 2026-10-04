import type { JmapClient } from 'jmap-client-ts'

import {
  EMAIL_LIST_PAGE_SIZE,
  EMAIL_LIST_PROPERTIES,
  orderByIds,
  type EmailListData,
  type EmailListItemData,
  type EmailListPage,
  type EmailSnippet,
  type SearchRequest
} from '@common/features/thread/queries'

import { hasSearchedWords } from './queries'

/** Largest window queried again; beyond, the results start over */
export const MAX_REFRESHED_RESULTS = 256

/**
 * Queries the loaded window of search results again, after emails the
 * results do not list changed: James has no `Email/queryChanges`. One
 * `Email/query` of the ids, then, only when new ids appear, the `Email/get`
 * and `SearchSnippet/get` of those ids. The listed emails are kept as they
 * are (push patched them). Null when the window is too large to query again.
 */
export async function refreshSearchWindow(
  client: JmapClient,
  accountId: string,
  { filter, sort }: SearchRequest,
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

  const query = await client.call('Email/query', {
    accountId,
    filter,
    sort: sort.length > 0 ? [...sort] : null,
    position: 0,
    limit: windowSize
  })
  const known = new Map(loaded.map(email => [email.id, email]))
  const missing = query.ids.filter(id => !known.has(id))
  const snippets = new Map<string, EmailSnippet>(
    data.pages.flatMap(page => Object.entries(page.snippets ?? {}))
  )
  // Fetched emails may be newer: the window keeps the state it was patched
  // to, and the next changes bring them again, harmlessly
  const state = firstPage.state
  if (missing.length > 0) {
    const [emails, found] = await client.requestSettled(builder => [
      builder.call('Email/get', {
        accountId,
        ids: missing,
        properties: [...EMAIL_LIST_PROPERTIES]
      }),
      builder.call('SearchSnippet/get', {
        accountId,
        filter: hasSearchedWords(filter) ? filter : null,
        emailIds: missing
      })
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
  }

  const emails = query.ids.flatMap((id): EmailListItemData[] => {
    const email = known.get(id)
    return email ? [email] : []
  })
  const total = query.total ?? null
  const isComplete = query.ids.length < windowSize
  const pageCount = Math.max(1, Math.ceil(emails.length / EMAIL_LIST_PAGE_SIZE))
  const pages = Array.from({ length: pageCount }, (_, index): EmailListPage => {
    const position = index * EMAIL_LIST_PAGE_SIZE
    const slice = emails.slice(position, position + EMAIL_LIST_PAGE_SIZE)
    return {
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
  })
  return { pages, pageParams: pages.map(page => page.position) }
}
