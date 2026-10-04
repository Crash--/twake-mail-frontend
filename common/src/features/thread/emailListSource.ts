import { infiniteQueryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'

import type { InfiniteQueryOptionsFor } from '@common/app/queryOptionsTypes'
import { fetchSearchPage } from '@common/features/search/queries'

import {
  EMAIL_LIST_PAGE_SIZE,
  fetchEmailListPage,
  getNextPosition,
  threadKeys,
  type EmailListPage,
  type SearchListKey,
  type SearchRequest,
  type ThreadListKey
} from './queries'

/** What an email list shows: the emails of a mailbox, or search results */
export type EmailListSource =
  | { kind: 'mailbox'; mailboxId: string }
  | { kind: 'search'; request: SearchRequest }

export type EmailListKey = ThreadListKey | SearchListKey

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
      source.kind === 'mailbox'
        ? threadKeys.list(accountId, source.mailboxId)
        : threadKeys.search(accountId, source.request),
    queryFn: ({ pageParam, signal }) =>
      source.kind === 'mailbox'
        ? fetchEmailListPage(
            client,
            accountId,
            source.mailboxId,
            pageParam,
            signal
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
