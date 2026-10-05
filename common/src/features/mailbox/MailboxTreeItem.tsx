import { Dots, Icon } from '@linagora/twake-icons'
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
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useDropEmails } from '@common/features/emailActions/useDropEmails'
import type { FolderMenuAnchor } from '@common/features/mailboxActions/FolderActionsMenu'
import { useI18n } from '@common/i18n/useI18n'

import { getMailboxIcon } from './mailboxDisplay'
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
}

/** The menu key, or Shift+F10: the keyboard way to a context menu */
function isMenuKey(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)
}

/**
 * A folder of the sidebar tree: icon, name, expand arrow and unread count,
 * linking to the folder, where dragged emails can drop; its menu opens from
 * the ⋮ button shown on hover or focus, a right click, the menu key or
 * Shift+F10. A hidden folder, shown on demand, says so.
 */
export function MailboxTreeItem({
  row,
  isSelected,
  onToggle,
  onOpenMenu
}: MailboxTreeItemProps): ReactElement {
  const { t } = useI18n()
  const getName = useMailboxName()
  const { mailbox } = row
  const toggleLabel = t(row.isExpanded ? 'mailbox.collapse' : 'mailbox.expand')
  // Keyboard users move emails from their menus: "Move message"
  const dropEmails = useDropEmails(mailbox)
  const name = getName(mailbox)
  const isHidden = isHiddenMailbox(mailbox)
  // The root of a team mailbox says its address
  const address = isTeamRoot(mailbox) ? teamMailboxAddress(mailbox) : null
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
  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>): void => {
    onOpenMenu(mailbox, { element: event.currentTarget })
  }

  return (
    <NavTreeItem
      level={row.level}
      icon={<Icon icon={getMailboxIcon(mailbox)} />}
      label={name}
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
            <SecondaryText
              variant="caption"
              className="u-ml-half"
              data-testid="mailbox-item-hidden"
            >
              {t('folders.hidden.label')}
            </SecondaryText>
          ) : null}
        </>
      }
      count={
        mailbox.unreadEmails > 0 ? (
          <CountBadge
            count={mailbox.unreadEmails}
            aria-hidden
            data-testid="mailbox-unread-count"
          />
        ) : null
      }
      countText={
        mailbox.unreadEmails > 0 ? String(mailbox.unreadEmails) : undefined
      }
      actions={
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
