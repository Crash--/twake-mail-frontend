import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, Button, IconButton, Tooltip } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import {
  Cancel,
  CheckboxOn,
  Cross,
  EmailNotification,
  MoveMailbox,
  Star
} from '@/ds/FlutterIcons/FlutterIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import { MoreVerticalIcon } from '@/ds/ListIcons/ListIcons'
import { SelectionCount } from '@/ds/SelectionCount/SelectionCount'
import { TMAIL } from '@/ds/TmailColors/tmailColors'
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
import { useLabelsAvailable } from '@common/features/labels/queries'
import { useI18n } from '@common/i18n/useI18n'

import type { EmailSelection } from './useEmailSelection'

/**
 * The actions of tmail-flutter's selection bar on a desktop
 * (`TopBarThreadSelection`), in its order: read, star, move, label, spam,
 * delete; the others (archive…) are in the menus of the rows
 */
const DESKTOP_ACTIONS: readonly (readonly EmailActionId[])[] = [
  ['mark-as-read', 'mark-as-unread'],
  ['star', 'unstar'],
  ['move'],
  ['label-as'],
  ['mark-as-spam', 'not-spam'],
  ['move-to-trash', 'delete-permanently']
]

/**
 * The actions of tmail-flutter's selection bar on phones and tablets (in
 * its app bar, `MobileAppBarThreadWidget`), after "Select all": archive,
 * delete, read or unread; the others in "More"
 */
const COMPACT_ACTIONS: readonly (readonly EmailActionId[])[] = [
  ['archive'],
  ['move-to-trash', 'delete-permanently'],
  ['mark-as-read', 'mark-as-unread']
]

/**
 * tmail-flutter's icons of its selection bar (`EmailSelectionActionType`),
 * where they differ from the menus
 */
const SELECTION_ICONS: Partial<Record<EmailActionId, IconProps['icon']>> = {
  star: Star,
  move: MoveMailbox,
  'mark-as-unread': EmailNotification
}

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
  /**
   * Once an action is done, or the selection cleared from the toolbar: the
   * selection is cleared and the focus goes back to the list, as the
   * toolbar goes away
   */
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
  const screenSize = useScreenSize()
  const isDesktop = screenSize === 'desktop'
  const { data: mailboxes = [] } = useMailboxes()
  const canLabel = useLabelsAvailable()
  const runAction = useRunEmailAction()
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const [targets, setTargets] = useState<readonly TargetEmail[]>([])
  const count = selection.isAllInFolder
    ? (total ?? loadedCount)
    : selection.selected.length
  const items = availableEmailActions(selectedTargets, mailbox, mailboxes, {
    canLabel
  })
  const buttons = (isDesktop ? DESKTOP_ACTIONS : COMPACT_ACTIONS).flatMap(ids =>
    items.filter(item => ids.includes(item.id))
  )
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
    if (isAllLoaded || selection.isAllInFolder) onDone()
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

  // tmail-flutter's `ic_cancel` before how many below the desktop size
  const clearButton = !isDesktop ? (
    <IconAction
      label={clearLabel}
      icon={Cancel}
      tone="steel"
      size={36}
      onClick={onDone}
      data-testid="selection-toolbar-clear"
    />
  ) : (
    <Tooltip title={clearLabel}>
      <IconButton
        aria-label={clearLabel}
        onClick={onDone}
        data-testid="selection-toolbar-clear"
      >
        <Icon icon={Cross} size={20} color={TMAIL.steel} />
      </IconButton>
    </Tooltip>
  )

  return (
    <Box
      component="section"
      aria-label={t('thread.selection.toolbar')}
      className={
        isDesktop
          ? 'u-flex u-flex-items-center u-flex-wrap u-ph-1'
          : 'u-flex u-flex-items-center u-w-100 u-h-100'
      }
      data-testid="selection-toolbar"
    >
      {/* As tmail-flutter's app bar below the desktop size: the cross
          first, then how many */}
      {isDesktop ? null : clearButton}
      <SelectionCount data-testid="selection-toolbar-count">
        {selection.isAllInFolder
          ? t('thread.selection.allInFolderSelected', { smart_count: count })
          : t('thread.selection.count', { count })}
      </SelectionCount>
      {isDesktop ? clearButton : null}
      {/* As tmail-flutter: 30 px before the actions */}
      {isDesktop ? <span className="u-mr-1-half" /> : null}
      {canSelectFolder && isDesktop ? (
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
      {isDesktop ? null : (
        <>
          <Box className="u-flex-auto" />
          {/* tmail-flutter's "Select all": its ticked box */}
          <IconAction
            label={selectAllLabel}
            icon={CheckboxOn}
            tone="steel"
            size={36}
            aria-pressed={isAllLoaded || selection.isAllInFolder}
            onClick={handleToggleAll}
            data-testid="selection-toolbar-select-all"
          />
        </>
      )}
      {buttons.map(item => (
        <IconAction
          key={item.id}
          label={t(item.label)}
          icon={SELECTION_ICONS[item.id] ?? item.icon}
          tone={
            item.id === 'star'
              ? 'starred'
              : item.id === 'delete-permanently' && !isDesktop
                ? 'danger'
                : 'steel'
          }
          size={36}
          onClick={() => {
            handleRun(item.id)
          }}
          data-testid={`selected-email-action-${item.id}`}
        />
      ))}
      {!isDesktop ? (
        <IconAction
          label={moreLabel}
          icon={MoreVerticalIcon}
          tone="steel"
          size={36}
          aria-haspopup="menu"
          aria-expanded={moreAnchor !== null}
          onClick={event => {
            handleOpenMore(event.currentTarget)
          }}
          data-testid="selected-email-action-more"
        />
      ) : null}
      <EmailActionsMenu
        anchor={moreAnchor === null ? null : { element: moreAnchor }}
        onClose={() => {
          setMoreAnchor(null)
        }}
        emails={targets}
        mailboxId={mailbox?.id ?? null}
        // As tmail-flutter below the desktop size: all the actions on a
        // selection (no answer), in a sheet from the bottom edge
        exclude={isDesktop ? buttons.map(item => item.id) : ['edit-as-new']}
        replies={[]}
        asSheet={!isDesktop}
        onAction={onDone}
        data-testid="selection-toolbar-menu"
      />
    </Box>
  )
}
