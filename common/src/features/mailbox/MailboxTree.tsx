import {
  ListItem,
  ListItemSkeleton,
  ListItemText,
  Nav
} from '@linagora/twake-mui'
import {
  useId,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { useMatch } from 'react-router'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import {
  buildMailboxTree,
  findAncestorIds,
  listVisibleMailboxes,
  type MailboxNode
} from './mailboxTree'
import { MailboxTreeItem } from './MailboxTreeItem'
import { useMailboxes } from './useMailboxes'

const SKELETON_ROWS = [1, 2, 3, 4, 5]

function hasSubfolders(node: MailboxNode): boolean {
  return node.children.length > 0
}

/**
 * The folder tree of the sidebar. Folders are collapsed, except the ones
 * leading to the selected folder, until the user toggles them.
 */
export function MailboxTree(): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const query = useMailboxes()
  const match = useMatch('/mailbox/:mailboxId/*')
  const selectedId = match?.params.mailboxId ?? null
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  const tree = useMemo(() => buildMailboxTree(query.data ?? []), [query.data])
  const selectedAncestors = useMemo(
    () =>
      new Set(
        selectedId === null ? [] : findAncestorIds(query.data ?? [], selectedId)
      ),
    [query.data, selectedId]
  )
  // Without any subfolder, no row needs room for an expand arrow
  const hasToggleSlot = tree.some(hasSubfolders)
  const rows = listVisibleMailboxes(
    tree,
    mailboxId => toggled[mailboxId] ?? selectedAncestors.has(mailboxId)
  )

  const handleToggle = (mailboxId: string, isExpanded: boolean): void => {
    setToggled(previous => ({ ...previous, [mailboxId]: !isExpanded }))
  }

  let content: ReactNode
  if (query.isPending) {
    content = SKELETON_ROWS.map(row => <ListItemSkeleton key={row} />)
  } else if (query.isError) {
    content = (
      <ListItem data-testid="mailbox-tree-error">
        <ListItemText secondary={t('common.errorOccurred')} />
      </ListItem>
    )
  } else {
    content = rows.map(row => (
      <MailboxTreeItem
        key={row.mailbox.id}
        row={row}
        isSelected={row.mailbox.id === selectedId}
        hasToggleSlot={hasToggleSlot}
        onToggle={handleToggle}
      />
    ))
  }

  // The title stays outside the tree: a tree only holds tree items
  return (
    <>
      <SecondaryText
        variant="subtitle2"
        component="h2"
        className="u-ph-1 u-pv-half"
        data-testid="mailbox-tree-title"
      >
        <span id={titleId}>{t('sidebar.folders')}</span>
      </SecondaryText>
      <Nav
        role="tree"
        aria-labelledby={titleId}
        aria-busy={query.isPending}
        data-testid="mailbox-tree"
      >
        {content}
      </Nav>
    </>
  )
}
