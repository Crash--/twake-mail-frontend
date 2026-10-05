import type { EmailFilterCondition } from 'jmap-client-ts'

import { FLAGGED, SEEN } from '@common/features/email/keywords'

import { MAILBOX_SORT, type SearchRequest } from './queries'

/**
 * The filters of the list toolbar, as tmail-flutter's `FilterMessageOption`:
 * one at a time, `all` for none
 */
export const LIST_FILTER_OPTIONS = ['attachments', 'unread', 'starred'] as const

export type ListFilterOption = (typeof LIST_FILTER_OPTIONS)[number]

export type ListFilter = ListFilterOption | 'all'

const CONDITIONS: Readonly<Record<ListFilterOption, EmailFilterCondition>> = {
  attachments: { hasAttachment: true },
  unread: { notKeyword: SEEN },
  starred: { hasKeyword: FLAGGED }
}

/** What the list the filter applies to is */
export interface ListFilterContext {
  /** The list is the Starred view: nothing to filter by "starred" */
  isStarredView: boolean
}

/** The filters offered by a list: `starred` makes no sense in Starred */
export function availableListFilters(
  context: ListFilterContext
): ListFilterOption[] {
  return LIST_FILTER_OPTIONS.filter(
    option => !(option === 'starred' && context.isStarredView)
  )
}

/**
 * The request of a list narrowed by `filter`: the same sort, the filter
 * ANDed. Search lists are patched by push, with paging, so a filtered folder
 * stays in sync as any search result does.
 */
export function withListFilter(
  request: SearchRequest,
  filter: ListFilter
): SearchRequest {
  if (filter === 'all') return request
  return {
    ...request,
    filter: {
      operator: 'AND',
      conditions: [request.filter, CONDITIONS[filter]]
    }
  }
}

/** The request of a folder narrowed by `filter` */
export function mailboxFilterRequest(
  mailboxId: string,
  filter: Exclude<ListFilter, 'all'>,
  collapseThreads: boolean
): SearchRequest {
  return {
    ...withListFilter(
      { filter: { inMailbox: mailboxId }, sort: MAILBOX_SORT },
      filter
    ),
    collapseThreads,
    // Emails leaving the folder leave the list
    mailboxId
  }
}
