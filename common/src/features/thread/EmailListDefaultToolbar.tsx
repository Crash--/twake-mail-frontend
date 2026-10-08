import { Restore, RestoreStraight, SelectAll } from '@linagora/twake-icons'
import { CircularProgress } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { CheckboxBlankIcon } from '@/ds/ListIcons/ListIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import { ListToolbar } from '@/ds/ListToolbar/ListToolbar'
import { ToolbarButton } from '@/ds/ToolbarButton/ToolbarButton'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { isPersonalMailbox } from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useRecovery } from '@common/features/recovery/RecoveryProvider'
import { useI18n } from '@common/i18n/useI18n'

import { EmailListFilterMenu } from './EmailListFilterMenu'
import type { ListFilter, ListFilterOption } from './listFilter'
import type { EmailSelection } from './useEmailSelection'

export interface ListToolbarFilter {
  current: ListFilter
  options: readonly ListFilterOption[]
  onSelect: (option: ListFilterOption) => void
  onClear: () => void
}

export interface EmailListDefaultToolbarProps {
  selection: EmailSelection
  /** Emails loaded in the list: nothing to select without */
  loadedCount: number
  /** The list is loading: "Select all" is there, not yet usable, so that the toolbar does not move when the emails land */
  isLoading?: boolean
  /** The folder shown, null for a label, Starred and search results */
  mailbox: MailboxSummary | null
  /** The filters of the list, null when it has none (search results, whose filters are above the list) */
  filter: ListToolbarFilter | null
  /** At the far end of the toolbar (the order of the search results) */
  end?: ReactNode
  isRefreshing: boolean
  onRefresh: () => void
}

/**
 * Above the list while nothing is selected, as tmail-flutter's: refresh
 * (a spinner while it runs), select all the messages of the page (hidden
 * for an empty list), the filter, and in the personal Trash the recovery of
 * deleted messages. Selecting a row turns it into the selection toolbar.
 * Phones show icons only.
 */
export function EmailListDefaultToolbar({
  selection,
  loadedCount,
  isLoading = false,
  mailbox,
  filter,
  end,
  isRefreshing,
  onRefresh
}: EmailListDefaultToolbarProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const recovery = useRecovery()
  const refreshLabel = t('common.refresh')
  const selectAllLabel = t('thread.toolbar.selectPage')
  const recoverLabel = t('recovery.title')
  const canRecover =
    mailbox !== null &&
    mailbox.role === 'trash' &&
    isPersonalMailbox(mailbox) &&
    recovery.isAvailable

  return (
    <ListToolbar label={t('thread.toolbar.label')} data-testid="list-toolbar">
      {isRefreshing ? (
        <span
          className="u-flex u-flex-items-center u-flex-justify-center u-w-2 u-h-2"
          data-testid="list-refresh-spinner"
        >
          <CircularProgress size={20} aria-label={t('common.loading')} />
        </span>
      ) : (
        <IconAction
          label={refreshLabel}
          icon={Restore}
          iconSize={16}
          tone="filled"
          onClick={onRefresh}
          data-testid="list-refresh-button"
        />
      )}
      {loadedCount === 0 && !isLoading ? null : isPhone ? (
        <IconAction
          label={selectAllLabel}
          icon={SelectAll}
          disabled={loadedCount === 0}
          onClick={selection.selectLoaded}
          data-testid="list-select-all-button"
        />
      ) : (
        <ToolbarButton
          label={selectAllLabel}
          tooltip={selectAllLabel}
          icon={CheckboxBlankIcon}
          disabled={loadedCount === 0}
          onClick={selection.selectLoaded}
          data-testid="list-select-all-button"
        />
      )}
      {filter === null ? null : (
        <EmailListFilterMenu
          current={filter.current}
          options={filter.options}
          onSelect={filter.onSelect}
          onClear={filter.onClear}
        />
      )}
      {canRecover ? (
        <IconAction
          label={recoverLabel}
          icon={RestoreStraight}
          onClick={recovery.open}
          data-testid="recover-deleted-messages-button"
        />
      ) : null}
      {end === undefined ? null : <span className="u-ml-auto">{end}</span>}
    </ListToolbar>
  )
}
