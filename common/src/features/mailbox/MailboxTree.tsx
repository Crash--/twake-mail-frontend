import {
  ListItem,
  ListItemSkeleton,
  ListItemText,
  ListSubheader,
  Nav
} from '@linagora/twake-mui'
import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { useMatch } from 'react-router'

import { useI18n } from '@common/i18n/useI18n'

import {
  buildMailboxTree,
  findAncestorIds,
  listVisibleMailboxes
} from './mailboxTree'
import { MailboxTreeItem } from './MailboxTreeItem'
import { useMailboxes } from './useMailboxes'

const SKELETON_ROWS = [1, 2, 3, 4, 5]

/**
 * The folder tree of the sidebar. Folders are collapsed, except the ones
 * leading to the selected folder, until the user toggles them.
 */
export function MailboxTree(): ReactElement {
  const { t } = useI18n()
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
        onToggle={handleToggle}
      />
    ))
  }

  return (
    <Nav
      role="tree"
      aria-label={t('sidebar.folders')}
      aria-busy={query.isPending}
      subheader={<ListSubheader>{t('sidebar.folders')}</ListSubheader>}
      data-testid="mailbox-tree"
    >
      {content}
    </Nav>
  )
}
