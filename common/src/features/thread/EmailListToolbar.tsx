import { Cross, Dots, Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  availableEmailActions,
  type EmailActionId
} from '@common/features/emailActions/emailActionItems'
import { EmailActionsMenu } from '@common/features/emailActions/EmailActionsMenu'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useRunEmailAction } from '@common/features/emailActions/useRunEmailAction'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useI18n } from '@common/i18n/useI18n'

import type { EmailSelection } from './useEmailSelection'

/** Buttons shown before the "More" menu, on phones */
const PHONE_BUTTONS = 3

export interface EmailListToolbarProps {
  selection: EmailSelection
  /**
   * The emails the selected rows act on (all the emails of a selected
   * conversation): what the actions offered depend on
   */
  targets?: readonly TargetEmail[]
  /** Emails loaded in the list */
  loadedCount: number
  /** Emails of the whole list, null when unknown */
  total: number | null
  /** The folder shown, null for search results */
  mailbox: MailboxSummary | null
  /** The emails to act on: the selected ones, or the whole folder */
  resolveTargets: () => Promise<readonly TargetEmail[]>
  /** Once an action is done: the selection is cleared */
  onDone: () => void
}

/**
 * Shown above the list while emails are selected, as tmail-flutter's
 * selection bar: how many, select all, the actions on them (the first
 * ones as buttons, the others in "More" on phones), and clear.
 */
export function EmailListToolbar({
  selection,
  targets: selectedTargets = selection.selected,
  loadedCount,
  total,
  mailbox,
  resolveTargets,
  onDone
}: EmailListToolbarProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const { data: mailboxes = [] } = useMailboxes()
  const runAction = useRunEmailAction()
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const [targets, setTargets] = useState<readonly TargetEmail[]>([])
  const count = selection.isAllInFolder
    ? (total ?? loadedCount)
    : selection.selected.length
  const items = availableEmailActions(selectedTargets, mailbox, mailboxes)
  const buttons = isPhone ? items.slice(0, PHONE_BUTTONS) : items
  const isAllLoaded = selection.selected.length === loadedCount
  const canSelectFolder =
    mailbox !== null &&
    !selection.isAllInFolder &&
    isAllLoaded &&
    total !== null &&
    total > loadedCount

  const handleRun = (id: EmailActionId): void => {
    void resolveTargets()
      .then(emails => runAction(id, emails, mailbox?.id ?? null))
      .then(done => {
        if (done) onDone()
      })
  }

  const handleToggleAll = (): void => {
    if (isAllLoaded || selection.isAllInFolder) selection.clear()
    else selection.selectLoaded()
  }

  const handleOpenMore = (element: HTMLElement): void => {
    void resolveTargets().then(emails => {
      setTargets(emails)
      setMoreAnchor(element)
    })
  }

  const selectAllLabel = t('thread.selection.selectAll')
  const clearLabel = t('thread.selection.clear')
  const moreLabel = t('emailActions.menu.more')

  return (
    <Box
      component="section"
      aria-label={t('thread.selection.toolbar')}
      className="u-flex u-flex-items-center u-flex-wrap u-ph-half"
      data-testid="selection-toolbar"
    >
      <Tooltip title={selectAllLabel}>
        <Checkbox
          // Not indeterminate: MUI then says aria-checked="mixed" on an
          // unchecked input, which axe refuses (docs/twake-mui-gaps.md)
          checked={isAllLoaded || selection.isAllInFolder}
          onChange={handleToggleAll}
          slotProps={{ input: { 'aria-label': selectAllLabel } }}
          data-testid="selection-toolbar-select-all"
        />
      </Tooltip>
      <Typography
        role="status"
        variant="body2"
        className="u-fw-bold u-mr-half"
        data-testid="selection-toolbar-count"
      >
        {selection.isAllInFolder
          ? t('thread.selection.allInFolderSelected', { smart_count: count })
          : t('thread.selection.count', { count })}
      </Typography>
      {canSelectFolder ? (
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          onClick={selection.selectAllInFolder}
          data-testid="selection-toolbar-select-folder"
        >
          {t('thread.selection.selectAllInFolder', { smart_count: total })}
        </Button>
      ) : null}
      <Box className="u-flex-auto" />
      {buttons.map(item => (
        <Tooltip key={item.id} title={t(item.label)}>
          <IconButton
            aria-label={t(item.label)}
            onClick={() => {
              handleRun(item.id)
            }}
            data-testid={`selected-email-action-${item.id}`}
          >
            <Icon icon={item.icon} />
          </IconButton>
        </Tooltip>
      ))}
      {buttons.length < items.length ? (
        <Tooltip title={moreLabel}>
          <IconButton
            aria-label={moreLabel}
            aria-haspopup="menu"
            aria-expanded={moreAnchor !== null}
            onClick={event => {
              handleOpenMore(event.currentTarget)
            }}
            data-testid="selected-email-action-more"
          >
            <Icon icon={Dots} />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title={clearLabel}>
        <IconButton
          aria-label={clearLabel}
          onClick={selection.clear}
          data-testid="selection-toolbar-clear"
        >
          <Icon icon={Cross} />
        </IconButton>
      </Tooltip>
      <EmailActionsMenu
        anchor={moreAnchor === null ? null : { element: moreAnchor }}
        onClose={() => {
          setMoreAnchor(null)
        }}
        emails={targets}
        mailboxId={mailbox?.id ?? null}
        exclude={buttons.map(item => item.id)}
        onAction={onDone}
        data-testid="selection-toolbar-menu"
      />
    </Box>
  )
}
