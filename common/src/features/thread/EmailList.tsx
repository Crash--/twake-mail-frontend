import { Email } from '@linagora/twake-icons'
import {
  Box,
  CircularProgress,
  Empty,
  useMediaQuery,
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
  useQueryClient,
  type UseInfiniteQueryResult
} from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { useLocation, useMatch } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { ListPane } from '@/ds/ListPane/ListPane'
import { SENDER_WIDTH } from '@/ds/RowSender/RowSender'
import { useFloatingActionInset } from '@/ds/FloatingActionButton/FloatingActionButton'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  VirtualizedListTable,
  type ListTableRange,
  type RowAttributes
} from '@/ds/VirtualizedListTable/VirtualizedListTable'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { listTemplatesMailboxIds } from '@common/features/composer/templatesFolder'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import {
  findMailboxIdByRole,
  isTeamDrafts,
  isTeamTemplates,
  isTemplatesMailbox
} from '@common/features/mailbox/mailboxTree'
import { useAiNeedsActionEnabled } from '@common/features/ai/aiNeedsAction'
import { useLabels } from '@common/features/labels/queries'
import { mailboxKeys } from '@common/features/mailbox/queries'
import { useShowsSenderPriority } from '@common/features/settings/serverSettings'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useOnlineStatus } from '@common/features/network/useOnlineStatus'
import { useThreadPreference } from '@common/features/settings/threadPreference'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { OPENED_FROM_LIST } from './conversationTarget'
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
import {
  EmailListDefaultToolbar,
  type ListToolbarFilter
} from './EmailListDefaultToolbar'
import { EmailListFilterMenu } from './EmailListFilterMenu'
import {
  availableListFilters,
  mailboxFilterRequest,
  withListFilter,
  type ListFilter
} from './listFilter'
import { useListFilter, useListFilterSlot } from './ListFilterProvider'
import { EmailSelectionContext, useEmailSelection } from './useEmailSelection'
import { EmailListSkeleton } from './EmailListSkeleton'
import { useNewEmailCount } from './useNewEmailCount'
import { getTrailingWidth, LEAD_WIDTH, ROW_LAYOUT } from './emailListGeometry'

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
  /** Its results open on the message that matched, not the first unread */
  opensAtMatch?: boolean
  /** The result open beside the list, if any */
  openEmailId: string | null
  /** Shown when nothing matches */
  empty: ReactElement
  /** At the end of the list toolbar: the order of the results */
  toolbarEnd?: ReactElement
  /**
   * Title of the page and name of the table, "Search results" by default
   * (a virtual folder such as Starred has its own)
   */
  title?: string
  /**
   * The list can be filtered by the toolbar (Starred, a label; not the
   * results of a search, which have their own filters): the name of the
   * list, the filter lasting while it is shown
   */
  filterScope?: string
  /** The list is the Starred view: no "starred" filter */
  isStarredView?: boolean
  /** The list is the Action required view: it is unread-only, no "unread" filter */
  isActionRequiredView?: boolean
}

export type EmailListProps = { mailboxId: string } | { search: EmailListSearch }

function useListQuery(
  props: EmailListProps,
  filter: ListFilter
): UseInfiniteQueryResult<EmailListData> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { isEnabled: collapseThreads } = useThreadPreference()
  let source: EmailListSource
  if ('search' in props) {
    source = {
      kind: 'search',
      request: withListFilter(props.search.request, filter)
    }
  } else if (filter === 'all') {
    source = { kind: 'mailbox', mailboxId: props.mailboxId, collapseThreads }
  } else {
    // A folder narrowed by a filter is a query list, which push keeps up to
    // date with its paging
    source = {
      kind: 'search',
      request: mailboxFilterRequest(props.mailboxId, filter, collapseThreads)
    }
  }
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
  const mailboxes = useMailboxes()
  const mailbox =
    mailboxes.data?.find(candidate => candidate.id === mailboxId) ?? null
  const filterScope =
    search === null
      ? `mailbox:${mailboxId ?? ''}`
      : (search.filterScope ?? null)
  const listFilter = useListFilter(filterScope)
  // Nothing to filter in an empty Trash or Spam: the filters are gone
  const isEmptyTrashOrSpam =
    mailbox !== null &&
    (mailbox.role === 'trash' || mailbox.role === 'junk') &&
    mailbox.totalEmails <= 0
  const filter: ListFilter = isEmptyTrashOrSpam ? 'all' : listFilter.filter
  const query = useListQuery(props, filter)
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
  // The Drafts and Templates of a team mailbox are known by their name
  const showRecipients =
    isTemplates ||
    (mailbox !== null && (isTeamDrafts(mailbox) || isTeamTemplates(mailbox))) ||
    (role !== null && RECIPIENT_ROLES.includes(role))
  // A result of a search opens on the message that matched; the rows of a
  // folder, a label or Starred on the first unread one
  const openState = search?.opensAtMatch === true ? undefined : OPENED_FROM_LIST
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
  const { session, accountId } = useJmapSession()
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
  const isOnline = useOnlineStatus()
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
  // Back from an email that left the list (deleted, moved), the focus goes
  // to the list: its first row
  const focusedIndex =
    focusEmailId === null
      ? null
      : Math.max(
          0,
          emails.findIndex(email => email.id === focusEmailId)
        )
  // Beside the list on large tablets: its row is highlighted like the
  // selected ones
  const openMailboxEmailId =
    useMatch('/mailbox/:mailboxId/email/:emailId')?.params.emailId ?? null
  const openEmailId = search === null ? openMailboxEmailId : search.openEmailId
  const newEmailCount = useNewEmailCount(emails, query.isSuccess)
  const selection = useEmailSelection(emails)
  const isHighlightedRow = useCallback(
    (row: VirtualizedTableRow): boolean =>
      row.id === openEmailId || selection.isSelected(String(row.id)),
    [openEmailId, selection]
  )
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
  const canHover = !useMediaQuery('(hover: none)')
  const columns = useMemo<(VirtualizedTableColumn & { id: EmailColumnId })[]>(
    () => [
      {
        id: 'lead',
        label: `${t('thread.columns.select')}, ${t('thread.columns.status')}`,
        width: LEAD_WIDTH,
        sortable: false,
        disablePadding: true
      },
      {
        id: 'sender',
        label: t(showRecipients ? 'email.to' : 'thread.columns.sender'),
        width: ROW_LAYOUT.gap + SENDER_WIDTH,
        sortable: false,
        disablePadding: true
      },
      {
        id: 'subject',
        label: t('thread.columns.subject'),
        sortable: false,
        disablePadding: true
      },
      {
        // The attachment and the date, which the actions replace on hover;
        // beside them without hover
        id: 'trailing',
        label: `${t('email.attachment')}, ${t('thread.columns.date')}, ${t('thread.columns.actions')}`,
        width: getTrailingWidth(canHover),
        textAlign: 'right',
        sortable: false,
        disablePadding: true
      }
    ],
    [t, showRecipients, canHover]
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
  // On phones the filter is in the top bar, as in tmail-flutter's app bar
  const filterSlot = useListFilterSlot()
  const { refetch } = query
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  // As tmail-flutter: the folders (their counts) and the emails
  const handleRefresh = useCallback((): void => {
    setIsRefreshing(true)
    Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: mailboxKeys.list(accountId) })
    ])
      .catch(() => undefined)
      .finally(() => {
        setIsRefreshing(false)
      })
  }, [refetch, queryClient, accountId])
  // Narrow from the first render below the desktop size, as tmail-flutter (its
  // wide tile is for `isWebDesktop` only); the table also measures itself for
  // the other cases (zoom, an email open beside the list)
  const isCompact = screenSize !== 'desktop'
  // The floating "New message" button covers the end of the list below the
  // desktop size (layout/AppLayout.tsx), and on a desktop in the facade of a
  // team mailbox (layout/TeamMailboxLayout.tsx)
  const bottomInset = useFloatingActionInset()

  const { openComposer } = useComposer()
  const showImportant = useShowsSenderPriority()
  const labels = useLabels().data?.list
  const showActionRequired = useAiNeedsActionEnabled()
  const handleOpenDraft = useCallback(
    (email: { id: string }): void => {
      openComposer({ draftId: email.id })
    },
    [openComposer]
  )
  const handleReply = useCallback(
    (email: { id: string }): void => {
      openComposer({ reply: { emailId: email.id, action: 'reply' } })
    },
    [openComposer]
  )
  // A template, found in its folder or by a search, opens as a new message,
  // which "Save as template" updates
  const templateMailboxIds = useMemo(
    () => new Set(listTemplatesMailboxIds(mailboxes.data ?? [])),
    [mailboxes.data]
  )
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
            openState={openState}
            getMailboxNames={getMailboxNames}
            showRecipients={showRecipients}
            onToggleStar={handleToggleStar}
            onToggleSeen={handleToggleSeen}
            onRemove={listActions.onRemove}
            deletesForever={listActions.deletesForever}
            onOpenMenu={listActions.onOpenMenu}
            onReply={handleReply}
            onMove={listActions.onMove}
            openEmailId={openEmailId}
            onOpenDraft={handleOpenDraft}
            onOpenTemplate={handleOpenTemplate}
            templateMailboxIds={templateMailboxIds}
            showImportant={showImportant}
            labels={labels}
            showActionRequired={showActionRequired}
          />
        )
      }
    }),
    [
      getEmailPath,
      openState,
      getMailboxNames,
      showRecipients,
      handleToggleStar,
      handleToggleSeen,
      listActions.onRemove,
      listActions.deletesForever,
      listActions.onOpenMenu,
      handleReply,
      listActions.onMove,
      openEmailId,
      handleOpenDraft,
      handleOpenTemplate,
      templateMailboxIds,
      showImportant,
      labels,
      showActionRequired
    ]
  )

  let content: ReactElement
  if (!isOnline && emails.length === 0) {
    // tmail-flutter: offline, an empty list says why, a search too. A first
    // load waits there for the network (TanStack pauses it), not on skeletons.
    content = (
      <Empty
        icon={Email}
        title={t('mailbox.offline')}
        data-testid="email-list-offline"
      />
    )
  } else if (query.isPending) {
    content = (
      <EmailListSkeleton isCompact={isCompact} className="u-flex-auto" />
    )
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
        text={t('mailbox.emptyHint')}
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
          rowLayout={ROW_LAYOUT}
          compact={isCompact}
          bottomInset={bottomInset}
          computeItemKey={computeRowKey}
          getRowProps={getRowProps}
          isSelectedItem={isHighlightedRow}
          focusedRowIndex={focusedIndex}
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

  const listToolbarFilter: ListToolbarFilter | null =
    filterScope === null || isEmptyTrashOrSpam
      ? null
      : {
          current: filter,
          options: availableListFilters({
            isStarredView: search?.isStarredView === true,
            isActionRequiredView: search?.isActionRequiredView === true
          }),
          onSelect: listFilter.select,
          onClear: listFilter.clear
        }
  const topBarSlot = screenSize === 'mobile' ? filterSlot : null
  const filterInToolbar = topBarSlot === null

  return (
    <EmailSelectionContext.Provider value={selection}>
      {listActions.banner}
      <ListPane>
        {listActions.toolbar ?? (
          <EmailListDefaultToolbar
            selection={selection}
            loadedCount={emails.length}
            isLoading={query.isPending}
            mailbox={mailbox}
            filter={filterInToolbar ? listToolbarFilter : null}
            end={search?.toolbarEnd}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        )}
        {topBarSlot !== null && listToolbarFilter !== null
          ? createPortal(
              <EmailListFilterMenu
                current={listToolbarFilter.current}
                options={listToolbarFilter.options}
                onSelect={listToolbarFilter.onSelect}
                onClear={listToolbarFilter.onClear}
              />,
              topBarSlot
            )
          : null}
        {content}
      </ListPane>
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
