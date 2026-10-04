import { Bottom, Icon, Right } from '@linagora/twake-icons'
import {
  IconButton,
  NavIcon,
  NavItem,
  NavLink,
  NavText,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'
import { Link } from 'react-router'

import { IconSlot } from '@/ds/IconSlot/IconSlot'
import { useI18n } from '@common/i18n/useI18n'

import { getMailboxIcon } from './mailboxDisplay'
import type { VisibleMailbox } from './mailboxTree'
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
}

/**
 * A folder of the sidebar tree: expand arrow, icon, name and unread count,
 * linking to the folder.
 */
export function MailboxTreeItem({
  row,
  isSelected,
  hasToggleSlot,
  onToggle
}: MailboxTreeItemProps): ReactElement {
  const { t } = useI18n()
  const getName = useMailboxName()
  const { mailbox } = row
  const toggleLabel = t(row.isExpanded ? 'mailbox.collapse' : 'mailbox.expand')

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
          {getName(mailbox)}
        </NavText>
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
    </NavItem>
  )
}
