import { Icon, Refresh, Restore, SelectAll } from '@linagora/twake-icons'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Tooltip
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

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
  /** The folder shown, null for a label, Starred and search results */
  mailbox: MailboxSummary | null
  /** The filters of the list, null when it has none (search results) */
  filter: ListToolbarFilter | null
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
  mailbox,
  filter,
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
  const spacing = isPhone ? '' : 'u-ml-1-half'

  return (
    <Box
      component="section"
      aria-label={t('thread.toolbar.label')}
      className="u-flex u-flex-items-center u-flex-wrap u-ph-1 u-pv-half"
      data-testid="list-toolbar"
    >
      {isRefreshing ? (
        <Box
          className="u-flex u-flex-items-center u-flex-justify-center"
          data-testid="list-refresh-spinner"
        >
          <CircularProgress size={24} aria-label={t('common.loading')} />
        </Box>
      ) : (
        <Tooltip title={refreshLabel}>
          <IconButton
            aria-label={refreshLabel}
            onClick={onRefresh}
            data-testid="list-refresh-button"
          >
            <Icon icon={Refresh} />
          </IconButton>
        </Tooltip>
      )}
      {loadedCount === 0 ? null : isPhone ? (
        <Tooltip title={selectAllLabel}>
          <IconButton
            aria-label={selectAllLabel}
            onClick={selection.selectLoaded}
            data-testid="list-select-all-button"
          >
            <Icon icon={SelectAll} />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title={selectAllLabel}>
          <Button
            variant="text"
            color="inherit"
            className={spacing}
            startIcon={<Icon icon={SelectAll} />}
            onClick={selection.selectLoaded}
            data-testid="list-select-all-button"
          >
            {t('thread.selection.selectAll')}
          </Button>
        </Tooltip>
      )}
      {filter === null ? null : (
        <EmailListFilterMenu
          className={spacing}
          current={filter.current}
          options={filter.options}
          onSelect={filter.onSelect}
          onClear={filter.onClear}
        />
      )}
      {canRecover ? (
        <Tooltip title={recoverLabel}>
          <IconButton
            className={spacing}
            aria-label={recoverLabel}
            onClick={recovery.open}
            data-testid="recover-deleted-messages-button"
          >
            <Icon icon={Restore} />
          </IconButton>
        </Tooltip>
      ) : null}
    </Box>
  )
}
