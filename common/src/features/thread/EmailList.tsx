import { Email } from '@linagora/twake-icons'
import {
  Box,
  CircularProgress,
  Empty,
  ListSkeleton,
  type VirtualizedTableColumn,
  type VirtualizedTableRow
} from '@linagora/twake-mui'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import {
  useInfiniteQuery,
  type UseInfiniteQueryResult
} from '@tanstack/react-query'
import { useLocation, useMatch } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { FLOATING_ACTION_INSET } from '@/ds/FloatingActionButton/FloatingActionButton'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  VirtualizedListTable,
  type ListTableRange,
  type RowAttributes
} from '@/ds/VirtualizedListTable/VirtualizedListTable'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'
import { useDocumentTitle } from '@common/app/useDocumentTitle'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useThreadPreference } from '@common/features/settings/threadPreference'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  EmailCell,
  emailPath as mailboxEmailPath,
  isEmailRow,
  type EmailColumnId,
  type EmailRowData
} from './EmailCell'
import {
  emailListSourceQueryOptions,
  type EmailListSource
} from './emailListSource'
import {
  type EmailListData,
  type EmailListItemData,
  type SearchRequest
} from './queries'
import { useEmailListShortcuts } from './useEmailListShortcuts'
import { useNewEmailCount } from './useNewEmailCount'

/** Folders whose list shows the recipients rather than the sender */
const RECIPIENT_ROLES: readonly string[] = [
  'sent',
  'drafts',
  'outbox',
  'templates'
]

/** Rows left below the visible ones when the next page is requested */
const PRELOAD_ROWS = 10

/** Rows rendered beyond the viewport, in pixels: for scrolling and focus */
const OVERSCAN_PX = 400

/**
 * Every email of the pages, once (positions shift when mail arrives), with
 * its search snippet when the list holds search results, and the size of
 * its conversation when the list shows one row per conversation
 */
function flattenPages(data: EmailListData | undefined): EmailRowData[] {
  const seen = new Set<string>()
  return (data?.pages ?? []).flatMap(page =>
    page.emails.flatMap((email): EmailRowData[] => {
      if (seen.has(email.id)) return []
      seen.add(email.id)
      return [
        {
          ...email,
          snippet: page.snippets?.[email.id] ?? null,
          threadSize: page.threadSizes?.[email.threadId] ?? null
        }
      ]
    })
  )
}

function computeRowKey(_index: number, row: VirtualizedTableRow): string {
  return String(row.id)
}

function getRowProps(row: VirtualizedTableRow): RowAttributes {
  if (!isEmailRow(row)) return {}
  const attributes: RowAttributes = {
    'data-testid': 'email-list-item',
    'data-email-id': row.id,
    'data-thread-id': row.threadId
  }
  if (!hasKeyword(row, SEEN)) attributes['data-unread'] = 'true'
  return attributes
}

/** Router state of the list: the email to focus, when coming back from it */
export interface EmailListLocationState {
  focusEmailId: string
}

function readFocusEmailId(state: unknown): string | null {
  return typeof state === 'object' &&
    state !== null &&
    'focusEmailId' in state &&
    typeof state.focusEmailId === 'string'
    ? state.focusEmailId
    : null
}

/** A list of search results rather than of the emails of a mailbox */
export interface EmailListSearch {
  request: SearchRequest
  /** Path of a result, opened beside or instead of the list */
  emailPath: (emailId: string) => string
  /** The result open beside the list, if any */
  openEmailId: string | null
  /** Shown when nothing matches */
  empty: ReactElement
}

export type EmailListProps = { mailboxId: string } | { search: EmailListSearch }

function useListQuery(
  props: EmailListProps
): UseInfiniteQueryResult<EmailListData> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { isEnabled: collapseThreads } = useThreadPreference()
  const source: EmailListSource =
    'search' in props
      ? { kind: 'search', request: props.search.request }
      : { kind: 'mailbox', mailboxId: props.mailboxId, collapseThreads }
  return useInfiniteQuery(
    emailListSourceQueryOptions(client, accountId, source)
  )
}

/**
 * The emails of a mailbox, most recent first, or the results of a search,
 * in a virtualized table that loads the next page when its end comes into
 * view. Each row is a link to the email; emails arriving by push are
 * announced to screen readers. Search results also show the mailboxes of
 * each email and highlight the matches.
 */
export function EmailList(props: EmailListProps): ReactElement {
  const { t } = useI18n()
  const search = 'search' in props ? props.search : null
  const mailboxId = 'mailboxId' in props ? props.mailboxId : null
  const query = useListQuery(props)
  const mailboxes = useMailboxes()
  const mailbox =
    mailboxes.data?.find(candidate => candidate.id === mailboxId) ?? null
  const role = mailbox?.role ?? null
  const getMailboxName = useMailboxName()
  useDocumentTitle(
    search === null
      ? mailbox === null
        ? null
        : getMailboxName(mailbox)
      : t('search.title')
  )
  const showRecipients = role !== null && RECIPIENT_ROLES.includes(role)
  const getEmailPath = useCallback(
    (emailId: string): string =>
      search === null
        ? mailboxEmailPath(mailboxId ?? '', emailId)
        : search.emailPath(emailId),
    [search, mailboxId]
  )
  // Search results come from any mailbox: each row says which
  const getMailboxNames = useCallback(
    (email: EmailListItemData): string | null => {
      if (search === null) return null
      const names = (mailboxes.data ?? [])
        .filter(candidate => candidate.id in email.mailboxIds)
        .map(getMailboxName)
      return names.length === 0 ? null : names.join(', ')
    },
    [search, mailboxes.data, getMailboxName]
  )
  const emails = useMemo(() => flattenPages(query.data), [query.data])
  const total = query.data?.pages[0]?.total ?? null
  const location = useLocation()
  const focusEmailId = readFocusEmailId(location.state)
  const focusedIndex =
    focusEmailId === null
      ? -1
      : emails.findIndex(email => email.id === focusEmailId)
  // Beside the list on large tablets: its row is the selected one
  const openMailboxEmailId =
    useMatch('/mailbox/:mailboxId/email/:emailId')?.params.emailId ?? null
  const openEmailId = search === null ? openMailboxEmailId : search.openEmailId
  const isOpenEmail = useCallback(
    (row: VirtualizedTableRow): boolean => row.id === openEmailId,
    [openEmailId]
  )
  const newEmailCount = useNewEmailCount(emails, query.isSuccess)
  const scrollerRef = useEmailListShortcuts(emails, mailboxId, openEmailId)
  const { run: runEmailAction } = useEmailActions()
  const [lastVisibleIndex, setLastVisibleIndex] = useState(0)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query

  // The table reports the end of the list again while a page loads, and
  // may call a stale handler: never cancel the fetch in flight, and read
  // whether a page is left at the time of the call. After the last page, a
  // call would not fetch but still mark the list fresh, and hold back the
  // refetch of a stale list shown again
  const hasNextPageRef = useRef(hasNextPage)
  useEffect(() => {
    hasNextPageRef.current = hasNextPage
  }, [hasNextPage])
  const handleEndReached = useCallback((): void => {
    if (!hasNextPageRef.current) return
    void fetchNextPage({ cancelRefetch: false })
  }, [fetchNextPage])

  const handleRangeChanged = useCallback((range: ListTableRange): void => {
    setLastVisibleIndex(range.endIndex)
  }, [])

  // endReached is not reported again when the page just appended still
  // ends in view: check after each page, and fetch a few rows ahead
  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastVisibleIndex >= emails.length - 1 - PRELOAD_ROWS
    ) {
      void fetchNextPage({ cancelRefetch: false })
    }
  }, [
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    lastVisibleIndex,
    emails.length
  ])

  const handleToggleStar = useCallback(
    (email: EmailListItemData): void => {
      void runEmailAction({
        action: hasKeyword(email, FLAGGED) ? 'unstar' : 'star',
        emails: [email],
        mailboxId,
        silent: true
      })
    },
    [runEmailAction, mailboxId]
  )

  const handleToggleSeen = useCallback(
    (email: EmailListItemData): void => {
      void runEmailAction({
        action: hasKeyword(email, SEEN) ? 'markAsUnread' : 'markAsRead',
        emails: [email],
        mailboxId,
        silent: true
      })
    },
    [runEmailAction, mailboxId]
  )

  // Stable, like the cell below: the rows of the table are memoized and
  // only render again when their email changes
  const columns = useMemo<(VirtualizedTableColumn & { id: EmailColumnId })[]>(
    () => [
      {
        id: 'status',
        label: t('thread.columns.status'),
        width: 72,
        sortable: false,
        disablePadding: true
      },
      {
        id: 'sender',
        label: t(showRecipients ? 'email.to' : 'thread.columns.sender'),
        width: 208,
        sortable: false
      },
      { id: 'subject', label: t('thread.columns.subject'), sortable: false },
      {
        id: 'attachment',
        label: t('email.attachment'),
        width: 40,
        sortable: false,
        disablePadding: true
      },
      {
        id: 'date',
        label: t('thread.columns.date'),
        width: 104,
        textAlign: 'right',
        sortable: false
      },
      {
        id: 'actions',
        label: t('thread.columns.actions'),
        width: 48,
        sortable: false,
        disablePadding: true
      }
    ],
    [t, showRecipients]
  )

  // Below 600 px of list: a phone, or the list beside an open email
  const compactColumns = useMemo<
    (VirtualizedTableColumn & { id: EmailColumnId })[]
  >(
    () => [
      {
        id: 'unread',
        label: t('thread.columns.status'),
        width: 20,
        sortable: false,
        disablePadding: true
      },
      { id: 'message', label: t('thread.columns.message'), sortable: false },
      {
        id: 'compactActions',
        label: t('thread.columns.actions'),
        width: 48,
        sortable: false,
        disablePadding: true
      }
    ],
    [t]
  )

  const screenSize = useScreenSize()
  // Narrow from the first render on phones and beside an open email (large
  // tablets); the table also measures itself for the other cases (zoom)
  const isCompact = screenSize === 'mobile' || screenSize === 'tabletLarge'
  // The floating "New message" button covers the end of the list below the
  // desktop size (layout/AppLayout.tsx)
  const bottomInset = screenSize === 'desktop' ? 0 : FLOATING_ACTION_INSET

  const componentsProps = useMemo(
    () => ({
      rowContent: {
        children: (
          <EmailCell
            getEmailPath={getEmailPath}
            getMailboxNames={getMailboxNames}
            showRecipients={showRecipients}
            onToggleStar={handleToggleStar}
            onToggleSeen={handleToggleSeen}
            openEmailId={openEmailId}
          />
        )
      }
    }),
    [
      getEmailPath,
      getMailboxNames,
      showRecipients,
      handleToggleStar,
      handleToggleSeen,
      openEmailId
    ]
  )

  let content: ReactElement
  if (query.isPending) {
    content = <ListSkeleton count={8} hasSecondary />
  } else if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    content = (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="email-list-error"
      />
    )
  } else if (emails.length === 0 && search !== null) {
    content = search.empty
  } else if (emails.length === 0) {
    content = (
      <Empty
        icon={Email}
        title={t('mailbox.empty')}
        data-testid="empty-thread-view"
      />
    )
  } else {
    content = (
      <>
        <VirtualizedListTable
          label={t(search === null ? 'mailbox.emails' : 'search.results')}
          className="u-flex-auto"
          data-testid="email-list"
          rows={emails}
          rowCount={total}
          columns={columns}
          compactColumns={compactColumns}
          compact={isCompact}
          bottomInset={bottomInset}
          computeItemKey={computeRowKey}
          getRowProps={getRowProps}
          isSelectedItem={isOpenEmail}
          focusedRowIndex={focusedIndex === -1 ? null : focusedIndex}
          endReached={handleEndReached}
          rangeChanged={handleRangeChanged}
          increaseViewportBy={OVERSCAN_PX}
          scrollerRef={scrollerRef}
          componentsProps={componentsProps}
        />
        {isFetchingNextPage ? (
          <Box className="u-flex u-flex-justify-center u-p-half">
            <CircularProgress size={24} aria-label={t('common.loading')} />
          </Box>
        ) : null}
      </>
    )
  }

  return (
    <>
      {content}
      {/* Always mounted: a live region only announces changes */}
      <Box
        role="status"
        className="u-visuallyhidden"
        data-testid="new-emails-status"
      >
        {newEmailCount > 0 ? (
          <span key={newEmailCount}>{t('push.newMessages')}</span>
        ) : null}
      </Box>
    </>
  )
}
