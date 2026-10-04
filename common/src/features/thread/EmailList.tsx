import { Email } from '@linagora/twake-icons'
import { Box, CircularProgress, Empty, ListSkeleton } from '@linagora/twake-mui'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { ListRange } from 'react-virtuoso'
import { Virtuoso } from 'react-virtuoso'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { FLAGGED, hasKeyword } from '@common/features/email/keywords'
import { useSetKeyword } from '@common/features/email/useSetKeyword'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useI18n } from '@common/i18n/useI18n'

import { EmailListItem } from './EmailListItem'
import type { EmailListData, EmailListItemData } from './queries'
import { useEmailList } from './useEmailList'

/** Rows left below the visible ones when the next page is requested */
const PRELOAD_ROWS = 10

/** Folders whose list shows the recipients rather than the sender */
const RECIPIENT_ROLES: readonly string[] = [
  'sent',
  'drafts',
  'outbox',
  'templates'
]

interface ListContext {
  isLoadingMore: boolean
}

function ListFooter({
  context
}: {
  context?: ListContext
}): ReactElement | null {
  const { t } = useI18n()
  if (!context?.isLoadingMore) return null
  return (
    <Box className="u-flex u-flex-justify-center u-p-1">
      <CircularProgress size={24} aria-label={t('common.loading')} />
    </Box>
  )
}

/** Every email of the pages, once: positions shift when mail arrives */
function flattenPages(data: EmailListData | undefined): EmailListItemData[] {
  const seen = new Set<string>()
  return (data?.pages ?? [])
    .flatMap(page => page.emails)
    .filter(email => {
      if (seen.has(email.id)) return false
      seen.add(email.id)
      return true
    })
}

export interface EmailListProps {
  mailboxId: string
}

/**
 * The emails of a mailbox, most recent first, in a virtualized list that
 * loads the next page when its end comes into view.
 */
export function EmailList({ mailboxId }: EmailListProps): ReactElement {
  const { t } = useI18n()
  const query = useEmailList(mailboxId)
  const mailboxes = useMailboxes()
  const role =
    mailboxes.data?.find(mailbox => mailbox.id === mailboxId)?.role ?? null
  const showRecipients = role !== null && RECIPIENT_ROLES.includes(role)
  const emails = useMemo(() => flattenPages(query.data), [query.data])
  const [lastVisibleIndex, setLastVisibleIndex] = useState(0)
  const { mutate: setKeyword } = useSetKeyword()
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query

  // Checked again after each page: the end of the list may still be in view
  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastVisibleIndex >= emails.length - 1 - PRELOAD_ROWS
    ) {
      void fetchNextPage()
    }
  }, [
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    lastVisibleIndex,
    emails.length
  ])

  if (query.isPending) {
    return <ListSkeleton count={8} hasSecondary />
  }

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="email-list-error"
      />
    )
  }

  if (emails.length === 0) {
    return (
      <Empty
        icon={Email}
        title={t('mailbox.empty')}
        data-testid="empty-thread-view"
      />
    )
  }

  const handleToggleStar = (email: EmailListItemData): void => {
    setKeyword({
      email,
      keyword: FLAGGED,
      isSet: !hasKeyword(email, FLAGGED)
    })
  }

  const handleRangeChanged = (range: ListRange): void => {
    setLastVisibleIndex(range.endIndex)
  }

  return (
    <Virtuoso
      role="list"
      aria-label={t('mailbox.emails')}
      className="u-flex-auto"
      data-testid="email-list"
      data={emails}
      context={{ isLoadingMore: isFetchingNextPage }}
      computeItemKey={(_index, email) => email.id}
      rangeChanged={handleRangeChanged}
      components={{ Footer: ListFooter }}
      itemContent={(_index, email) => (
        <EmailListItem
          email={email}
          mailboxId={mailboxId}
          showRecipients={showRecipients}
          onToggleStar={handleToggleStar}
        />
      )}
    />
  )
}
