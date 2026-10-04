import { Bottom, Dots, Icon, Right } from '@linagora/twake-icons'
import {
  IconButton,
  NavIcon,
  NavItem,
  NavLink,
  NavText,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement
} from 'react'
import { Link } from 'react-router'

import { DropTarget } from '@/ds/DropTarget/DropTarget'
import { IconSlot } from '@/ds/IconSlot/IconSlot'
import { RowHoverActions } from '@/ds/RowHoverActions/RowHoverActions'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useDropEmails } from '@common/features/emailActions/useDropEmails'
import type { FolderMenuAnchor } from '@common/features/mailboxActions/FolderActionsMenu'
import { useI18n } from '@common/i18n/useI18n'

import { getMailboxIcon } from './mailboxDisplay'
import { isHiddenMailbox, type VisibleMailbox } from './mailboxTree'
import type { MailboxSummary } from './queries'
import { useMailboxName } from './useMailboxName'

/**
 * Indentation of the nested levels, in twake-css padding classes. Deeper
 * folders share the last one (see docs/twake-mui-gaps.md, mailbox tree).
 */
const LEVEL_INDENT_CLASSES = ['', 'u-pl-1', 'u-pl-2', 'u-pl-3'] as const

function indentClass(level: number): string {
  const index = Math.min(level - 1, LEVEL_INDENT_CLASSES.length - 1)
  return LEVEL_INDENT_CLASSES[index] ?? ''
}

export interface MailboxTreeItemProps {
  row: VisibleMailbox
  isSelected: boolean
  /**
   * Reserves the room of the expand arrow, to align the rows: only when
   * some folder of the tree has subfolders
   */
  hasToggleSlot: boolean
  onToggle: (mailboxId: string, isExpanded: boolean) => void
  /** Opens the menu of the folder */
  onOpenMenu: (mailbox: MailboxSummary, anchor: FolderMenuAnchor) => void
}

/** The menu key, or Shift+F10: the keyboard way to a context menu */
function isMenuKey(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)
}

/**
 * A folder of the sidebar tree: expand arrow, icon, name and unread count,
 * linking to the folder, where dragged emails can drop; its menu opens from
 * the ⋮ button shown on hover or focus, a right click, the menu key or
 * Shift+F10. A hidden folder, shown on demand, says so.
 */
export function MailboxTreeItem({
  row,
  isSelected,
  hasToggleSlot,
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

  const handleToggle = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    onToggle(mailbox.id, row.isExpanded)
  }

  return (
    <NavItem
      role="treeitem"
      className={indentClass(row.level)}
      aria-level={row.level}
      aria-posinset={row.position}
      aria-setsize={row.siblingCount}
      aria-selected={isSelected}
      aria-current={isSelected ? 'page' : undefined}
      aria-expanded={row.hasChildren ? row.isExpanded : undefined}
      data-testid="mailbox-item"
      data-mailbox-id={mailbox.id}
      data-mailbox-role={mailbox.role ?? undefined}
      data-hidden={isHidden || undefined}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {hasToggleSlot ? (
        <IconSlot data-testid="mailbox-toggle-slot">
          {row.hasChildren ? (
            <Tooltip title={toggleLabel}>
              <IconButton
                size="small"
                aria-label={toggleLabel}
                onClick={handleToggle}
                data-testid="mailbox-expand-button"
              >
                <Icon icon={row.isExpanded ? Bottom : Right} size={12} />
              </IconButton>
            </Tooltip>
          ) : null}
        </IconSlot>
      ) : null}
      <DropTarget
        accepts={dropEmails.accepts}
        onDrop={dropEmails.onDrop}
        className="u-flex u-flex-auto u-ov-hidden"
      >
        <NavLink
          component={Link}
          to={`/mailbox/${encodeURIComponent(mailbox.id)}`}
          selected={isSelected}
          // The slot replaces the start margin of the link
          className={hasToggleSlot ? 'u-ml-0 u-ov-hidden' : 'u-ov-hidden'}
        >
          <NavIcon icon={getMailboxIcon(mailbox)} />
          <NavText
            className="u-flex-auto u-ellipsis"
            data-testid="mailbox-item-name"
          >
            {name}
          </NavText>
          {isHidden ? (
            <SecondaryText
              variant="caption"
              className="u-ml-half"
              data-testid="mailbox-item-hidden"
            >
              {t('folders.hidden.label')}
            </SecondaryText>
          ) : null}
          {mailbox.unreadEmails > 0 ? (
            <Typography
              variant="caption"
              className="u-fw-bold u-ml-half"
              data-testid="mailbox-unread-count"
            >
              {mailbox.unreadEmails}
            </Typography>
          ) : null}
        </NavLink>
      </DropTarget>
      <RowHoverActions in="listItem">
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
      </RowHoverActions>
    </NavItem>
  )
}
