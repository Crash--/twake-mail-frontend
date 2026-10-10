import { infiniteQueryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'

import type { InfiniteQueryOptionsFor } from '@common/app/queryOptionsTypes'
import { fetchSearchPage } from '@common/features/search/queries'

import { mailboxFilterRequest, type ListFilter } from './listFilter'
import {
  EMAIL_LIST_PAGE_SIZE,
  fetchEmailListPage,
  getNextPosition,
  threadKeys,
  type EmailListPage,
  type ConversationListKey,
  type SearchListKey,
  type SearchRequest,
  type ThreadListKey
} from './queries'

/** What an email list shows: the emails of a mailbox, or search results */
export type EmailListSource =
  | {
      kind: 'mailbox'
      mailboxId: string
      /** One row per conversation, its most recent email */
      collapseThreads?: boolean
    }
  | { kind: 'search'; request: SearchRequest }

export type EmailListKey = ThreadListKey | ConversationListKey | SearchListKey

/** The scope of the filter of the list of a folder (`useListFilter`) */
export function mailboxFilterScope(mailboxId: string): string {
  return `mailbox:${mailboxId}`
}

/**
 * What the list of a folder shows, narrowed by `filter`: its rows and the
 * "Previous" / "Next" of the reading view read the same cache entry, so
 * that a refresh reorders both
 */
export function mailboxListSource(
  mailboxId: string,
  filter: ListFilter,
  collapseThreads: boolean
): EmailListSource {
  // A folder narrowed by a filter is a query list, which push keeps up to
  // date with its paging
  return filter === 'all'
    ? { kind: 'mailbox', mailboxId, collapseThreads }
    : {
        kind: 'search',
        request: mailboxFilterRequest(mailboxId, filter, collapseThreads)
      }
}

/**
 * The pages of an email list, whatever it shows. Push keeps them up to date
 * (`features/push/`): James has no `Email/queryChanges`.
 */
export function emailListSourceQueryOptions(
  client: JmapClient,
  accountId: string,
  source: EmailListSource
): InfiniteQueryOptionsFor<EmailListPage, EmailListKey, number> {
  return infiniteQueryOptions({
    queryKey:
      source.kind === 'search'
        ? threadKeys.search(accountId, source.request)
        : source.collapseThreads === true
          ? threadKeys.threads(accountId, source.mailboxId)
          : threadKeys.list(accountId, source.mailboxId),
    queryFn: ({ pageParam, signal }) =>
      source.kind === 'mailbox'
        ? fetchEmailListPage(
            client,
            accountId,
            source.mailboxId,
            pageParam,
            signal,
            source.collapseThreads === true
          )
        : fetchSearchPage(
            client,
            accountId,
            source.request,
            pageParam,
            EMAIL_LIST_PAGE_SIZE,
            signal
          ),
    initialPageParam: 0,
    getNextPageParam: getNextPosition
  })
}
