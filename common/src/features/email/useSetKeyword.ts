import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationResult
} from '@tanstack/react-query'
import { assertSetSucceeded, type Email } from 'jmap-client-ts'

import {
  mailboxKeys,
  type MailboxSummary
} from '@common/features/mailbox/queries'
import { threadKeys, type EmailListData } from '@common/features/thread/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { hasKeyword, SEEN, withKeyword, type EmailKeyword } from './keywords'
import { emailKeys, type EmailDetail } from './queries'

export interface SetKeywordVariables {
  /** The email as displayed, to know its mailboxes and current keywords */
  email: Pick<Email, 'id' | 'mailboxIds' | 'keywords'>
  keyword: EmailKeyword
  isSet: boolean
}

/** The cache entries the optimistic update touched, to roll it back */
interface CacheSnapshot {
  entries: [QueryKey, unknown][]
}

function updateListKeywords(
  data: EmailListData | undefined,
  { email, keyword, isSet }: SetKeywordVariables
): EmailListData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      emails: page.emails.map(item =>
        item.id === email.id
          ? { ...item, keywords: withKeyword(item.keywords, keyword, isSet) }
          : item
      )
    }))
  }
}

function updateUnreadCounts(
  mailboxes: MailboxSummary[] | undefined,
  { email, isSet }: SetKeywordVariables
): MailboxSummary[] | undefined {
  const delta = isSet ? -1 : 1
  return mailboxes?.map(mailbox =>
    mailbox.id in email.mailboxIds
      ? {
          ...mailbox,
          unreadEmails: Math.max(0, mailbox.unreadEmails + delta)
        }
      : mailbox
  )
}

function snapshot(
  queryClient: QueryClient,
  queryKeys: readonly QueryKey[]
): CacheSnapshot {
  return {
    entries: queryKeys.flatMap(queryKey =>
      queryClient.getQueriesData({ queryKey })
    )
  }
}

/**
 * Sets or removes a keyword of an email (`$seen`, `$flagged`) with
 * `Email/set`. The cache is updated at once, the server answer confirms it:
 * the email lists, the email itself and, for `$seen`, the unread counts of
 * its mailboxes. Rolled back if the server refuses.
 */
export function useSetKeyword(): UseMutationResult<
  void,
  Error,
  SetKeywordVariables,
  CacheSnapshot
> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const queryClient = useQueryClient()
  const listsKey = threadKeys.all(accountId)
  const mailboxesKey = mailboxKeys.list(accountId)

  return useMutation({
    mutationFn: async ({ email, keyword, isSet }) => {
      const response = await client.call('Email/set', {
        accountId,
        update: { [email.id]: { [`keywords/${keyword}`]: isSet ? true : null } }
      })
      assertSetSucceeded(response)
    },

    onMutate: async variables => {
      const { email, keyword, isSet } = variables
      const detailKey = emailKeys.detail(accountId, email.id)
      const touchedKeys = [listsKey, detailKey, mailboxesKey]
      await Promise.all(
        touchedKeys.map(queryKey => queryClient.cancelQueries({ queryKey }))
      )
      const previous = snapshot(queryClient, touchedKeys)

      queryClient.setQueriesData<EmailListData>({ queryKey: listsKey }, data =>
        updateListKeywords(data, variables)
      )
      queryClient.setQueryData<EmailDetail | null>(detailKey, detail =>
        detail
          ? {
              ...detail,
              keywords: withKeyword(detail.keywords, keyword, isSet)
            }
          : detail
      )
      // The counters only move when the email really changes state
      if (keyword === SEEN && hasKeyword(email, SEEN) !== isSet) {
        queryClient.setQueryData<MailboxSummary[]>(mailboxesKey, mailboxes =>
          updateUnreadCounts(mailboxes, variables)
        )
      }
      return previous
    },

    onError: (error, _variables, previous) => {
      console.error('[email] Cannot update the keywords', error)
      previous?.entries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: mailboxesKey })
  })
}
