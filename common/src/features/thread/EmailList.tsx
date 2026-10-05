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
import { useComposer } from '@common/features/composer/ComposerProvider'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import {
  findMailboxIdByRole,
  isTemplatesMailbox
} from '@common/features/mailbox/mailboxTree'
import { useShowsSenderPriority } from '@common/features/settings/serverSettings'
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
  type SearchRequest,
  type ThreadMember
} from './queries'
import { summarizeThread, type ThreadSummary } from './threadSummary'
import { useEmailListActions } from './useEmailListActions'
import { useEmailListShortcuts } from './useEmailListShortcuts'
import { EmailSelectionContext, useEmailSelection } from './useEmailSelection'
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
 * its search snippet when the list holds search results, and the summary
 * of its conversation when the list shows one row per conversation
 */
function flattenPages(
  data: EmailListData | undefined,
  summarize: (
    members: readonly ThreadMember[],
    rowEmailId: string
  ) => ThreadSummary
): EmailRowData[] {
  const seen = new Set<string>()
  return (data?.pages ?? []).flatMap(page =>
    page.emails.flatMap((email): EmailRowData[] => {
      if (seen.has(email.id)) return []
      seen.add(email.id)
      const members = page.threads?.[email.threadId]
      return [
        {
          ...email,
          snippet: page.snippets?.[email.id] ?? null,
          thread: members === undefined ? null : summarize(members, email.id)
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
  if (row.thread?.isUnread ?? !hasKeyword(row, SEEN)) {
    attributes['data-unread'] = 'true'
  }
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
  /**
   * Title of the page and name of the table, "Search results" by default
   * (a virtual folder such as Starred has its own)
   */
  title?: string
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
      : (search.title ?? t('search.title'))
  )
  const isTemplates = mailbox !== null && isTemplatesMailbox(mailbox)
  const showRecipients =
    isTemplates || (role !== null && RECIPIENT_ROLES.includes(role))
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
  const { session } = useJmapSession()
  const meLabel = t('thread.me')
  const sentId = findMailboxIdByRole(mailboxes.data ?? [], 'sent')
  const emails = useMemo(
    () =>
      flattenPages(query.data, (members, rowEmailId) =>
        summarizeThread(members, {
          ownAddress: session.username,
          meLabel,
          sentId,
          rowEmailId
        })
      ),
    [query.data, session.username, meLabel, sentId]
  )
  // The actions on a conversation act on all its emails
  const expandTargets = useCallback(
    (rows: readonly EmailListItemData[]): TargetEmail[] => {
      const byId = new Map(emails.map(row => [row.id, row]))
      return rows.flatMap(row => byId.get(row.id)?.thread?.members ?? [row])
    },
    [emails]
  )
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
  const selection = useEmailSelection(emails)
  const { scrollerRef, focusList } = useEmailListShortcuts(
    emails,
    mailboxId,
    openEmailId,
    selection,
    expandTargets
  )
  const listActions = useEmailListActions({
    emails,
    selection,
    mailbox: search === null ? mailbox : null,
    mailboxId,
    total,
    expandTargets,
    onFocusList: focusList
  })
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

  // A conversation is starred, or unread, when one of its emails is: the
  // toggles apply to all of them
  const handleToggleStar = useCallback(
    (row: EmailRowData): void => {
      const isStarred = row.thread?.isStarred ?? hasKeyword(row, FLAGGED)
      void runEmailAction({
        action: isStarred ? 'unstar' : 'star',
        emails: row.thread?.members ?? [row],
        mailboxId,
        silent: true
      })
    },
    [runEmailAction, mailboxId]
  )

  const handleToggleSeen = useCallback(
    (row: EmailRowData): void => {
      const isUnread = row.thread?.isUnread ?? !hasKeyword(row, SEEN)
      void runEmailAction({
        action: isUnread ? 'markAsRead' : 'markAsUnread',
        emails: row.thread?.members ?? [row],
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
        id: 'select',
        label: t('thread.columns.select'),
        width: 40,
        sortable: false,
        disablePadding: true
      },
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
        width: 112,
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
        id: 'select',
        label: t('thread.columns.select'),
        width: 44,
        sortable: false,
        disablePadding: true
      },
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

  const { openComposer } = useComposer()
  const showImportant = useShowsSenderPriority()
  const handleOpenDraft = useCallback(
    (email: { id: string }): void => {
      openComposer({ draftId: email.id })
    },
    [openComposer]
  )
  // A template opens as a new message, which "Save as template" updates
  const handleOpenTemplate = useCallback(
    (email: { id: string }): void => {
      openComposer({ templateId: email.id })
    },
    [openComposer]
  )

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
            onRemove={listActions.onRemove}
            deletesForever={listActions.deletesForever}
            onOpenMenu={listActions.onOpenMenu}
            openEmailId={openEmailId}
            onOpenDraft={handleOpenDraft}
            onOpenTemplate={isTemplates ? handleOpenTemplate : undefined}
            showImportant={showImportant}
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
      listActions.onRemove,
      listActions.deletesForever,
      listActions.onOpenMenu,
      openEmailId,
      handleOpenDraft,
      handleOpenTemplate,
      isTemplates,
      showImportant
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
          label={
            search === null
              ? t('mailbox.emails')
              : (search.title ?? t('search.results'))
          }
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
          onRowMenu={listActions.onRowMenu}
          onRowDragStart={listActions.onRowDragStart}
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
    <EmailSelectionContext.Provider value={selection}>
      {listActions.banner}
      {listActions.toolbar}
      {content}
      {listActions.menu}
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
    </EmailSelectionContext.Provider>
  )
}
