import { Dots, EyeClosed, Icon } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import {
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement
} from 'react'
import { Link } from 'react-router'

import { CountBadge } from '@/ds/CountBadge/CountBadge'
import { NavTreeItem } from '@/ds/NavTreeItem/NavTreeItem'
import { RowTextAction } from '@/ds/RowTextAction/RowTextAction'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useDropEmails } from '@common/features/emailActions/useDropEmails'
import type { FolderMenuAnchor } from '@common/features/mailboxActions/FolderActionsMenu'
import { useFolderActions } from '@common/features/mailboxActions/FolderActionsProvider'
import { useI18n } from '@common/i18n/useI18n'

import {
  getMailboxIcon,
  showsTotalCount,
  showsUnreadCount
} from './mailboxDisplay'
import {
  isHiddenMailbox,
  isTeamRoot,
  teamMailboxAddress,
  type VisibleMailbox
} from './mailboxTree'
import type { MailboxSummary } from './queries'
import { useMailboxName } from './useMailboxName'

export interface MailboxTreeItemProps {
  row: VisibleMailbox
  isSelected: boolean
  onToggle: (mailboxId: string, isExpanded: boolean) => void
  /** Opens the menu of the folder */
  onOpenMenu: (mailbox: MailboxSummary, anchor: FolderMenuAnchor) => void
  /** A second line under the name: where a search result is */
  secondary?: string | null
}

/** The menu key, or Shift+F10: the keyboard way to a context menu */
function isMenuKey(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)
}

/**
 * A folder of the sidebar tree: icon, name, expand arrow and unread count,
 * linking to the folder, where dragged emails can drop; its menu opens from
 * the ⋮ button shown on hover or focus, a right click, the menu key or
 * Shift+F10. On the Spam, "Clean" empties it. A hidden folder, shown on
 * demand, has the icon of hidden folders and says so.
 */
export function MailboxTreeItem({
  row,
  isSelected,
  onToggle,
  onOpenMenu,
  secondary
}: MailboxTreeItemProps): ReactElement {
  const { t } = useI18n()
  const getName = useMailboxName()
  const folderActions = useFolderActions()
  const { mailbox } = row
  const toggleLabel = t(row.isExpanded ? 'mailbox.collapse' : 'mailbox.expand')
  // Keyboard users move emails from their menus: "Move message"
  const dropEmails = useDropEmails(mailbox)
  const name = getName(mailbox)
  const isHidden = isHiddenMailbox(mailbox)
  // The root of a team mailbox says its address
  const address = isTeamRoot(mailbox) ? teamMailboxAddress(mailbox) : null
  const shownCount = showsUnreadCount(mailbox)
    ? { count: mailbox.unreadEmails, testId: 'mailbox-unread-count' }
    : showsTotalCount(mailbox)
      ? { count: mailbox.totalEmails, testId: 'mailbox-total-count' }
      : null
  // "Clean" empties the Spam, as the menu item does
  const canEmptySpam = mailbox.role === 'junk' && mailbox.totalEmails > 0
  const menuLabel = t('folders.menu.button', { name })
  // The menu key may also send a contextmenu event: open the menu once
  const openedByKey = useRef(false)

  const handleContextMenu = (event: MouseEvent<HTMLElement>): void => {
    event.preventDefault()
    if (openedByKey.current) {
      openedByKey.current = false
      return
    }
    onOpenMenu(mailbox, {
      position: { left: event.clientX, top: event.clientY }
    })
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!isMenuKey(event)) return
    event.preventDefault()
    openedByKey.current = true
    window.setTimeout(() => {
      openedByKey.current = false
    }, 0)
    onOpenMenu(mailbox, { element: event.currentTarget })
  }
  const handleEmptySpam = (): void => {
    folderActions.run('empty-spam', mailbox)
  }
  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>): void => {
    onOpenMenu(mailbox, { element: event.currentTarget })
  }

  return (
    <NavTreeItem
      level={row.level}
      icon={
        isHidden ? (
          // As tmail-flutter, a hidden folder takes the icon of the hidden
          // folders, with the word for who does not see it
          <Tooltip title={t('folders.hidden.label')}>
            <span className="u-flex u-flex-items-center">
              <Icon icon={EyeClosed} />
            </span>
          </Tooltip>
        ) : (
          <Icon icon={getMailboxIcon(mailbox)} />
        )
      }
      label={name}
      secondary={secondary}
      linkComponent={Link}
      to={`/mailbox/${encodeURIComponent(mailbox.id)}`}
      isSelected={isSelected}
      toggle={
        row.hasChildren
          ? {
              label: toggleLabel,
              isExpanded: row.isExpanded,
              onToggle: () => {
                onToggle(mailbox.id, row.isExpanded)
              },
              'data-testid': 'mailbox-expand-button'
            }
          : undefined
      }
      meta={
        <>
          {address === null ? null : (
            <SecondaryText
              variant="caption"
              className="u-ml-half"
              data-testid="mailbox-item-address"
            >
              {address}
            </SecondaryText>
          )}
          {isHidden ? (
            <span
              className="u-visuallyhidden"
              data-testid="mailbox-item-hidden"
            >
              {` ${t('folders.hidden.label')}`}
            </span>
          ) : null}
        </>
      }
      count={
        shownCount === null ? null : (
          <CountBadge
            count={shownCount.count}
            aria-hidden
            data-testid={shownCount.testId}
          />
        )
      }
      countText={shownCount === null ? undefined : String(shownCount.count)}
      actions={
        <>
          {canEmptySpam ? (
            <RowTextAction
              description={t('folders.menu.emptySpam')}
              onClick={handleEmptySpam}
              data-testid="mailbox-clean-button"
            >
              {t('folders.clean')}
            </RowTextAction>
          ) : null}
          <Tooltip title={menuLabel}>
            <IconButton
              size="small"
              aria-label={menuLabel}
              aria-haspopup="menu"
              onClick={handleOpenMenu}
              data-testid="mailbox-more-button"
            >
              <Icon icon={Dots} />
            </IconButton>
          </Tooltip>
        </>
      }
      drop={dropEmails}
      nameTestId="mailbox-item-name"
      data-testid="mailbox-item"
      itemProps={{
        role: 'treeitem',
        'aria-level': row.level,
        'aria-posinset': row.position,
        'aria-setsize': row.siblingCount,
        'aria-selected': isSelected,
        'aria-current': isSelected ? 'page' : undefined,
        'aria-expanded': row.hasChildren ? row.isExpanded : undefined,
        'data-mailbox-id': mailbox.id,
        'data-mailbox-role': mailbox.role ?? undefined,
        'data-hidden': isHidden || undefined,
        onContextMenu: handleContextMenu,
        onKeyDown: handleKeyDown
      }}
    />
  )
}
