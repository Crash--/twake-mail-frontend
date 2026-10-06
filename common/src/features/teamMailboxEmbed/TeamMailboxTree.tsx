import { ListItem, ListItemSkeleton, ListItemText } from '@linagora/twake-mui'
import { useId, useMemo, useState, type ReactElement } from 'react'
import { useMatch } from 'react-router'

import { NavSectionHeader } from '@/ds/NavSectionHeader/NavSectionHeader'
import { NavTree } from '@/ds/NavTree/NavTree'
import {
  buildMailboxTree,
  findAncestorIds,
  listVisibleMailboxes
} from '@common/features/mailbox/mailboxTree'
import { MailboxTreeItem } from '@common/features/mailbox/MailboxTreeItem'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import {
  FolderActionsMenu,
  type FolderMenuAnchor
} from '@common/features/mailboxActions/FolderActionsMenu'
import { useI18n } from '@common/i18n/useI18n'

import { findTeamMailboxRoot, isInTeamMailbox } from './teamMailbox'

const SKELETON_ROWS = [1, 2, 3, 4, 5]

export interface TeamMailboxTreeProps {
  /** The address of the team mailbox, lowercased */
  address: string
}

/**
 * The folders of one team mailbox, under its name: its system folders
 * first, as in the "Team-mailboxes" section of the webmail, and its
 * subfolders. Hidden or not in the settings, they show: the facade is for
 * this mailbox.
 */
export function TeamMailboxTree({
  address
}: TeamMailboxTreeProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const query = useMailboxes()
  const match = useMatch('/mailbox/:mailboxId/*')
  const selectedId = match?.params.mailboxId ?? null
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [menu, setMenu] = useState<{
    mailbox: MailboxSummary
    anchor: FolderMenuAnchor
  } | null>(null)

  const folders = useMemo(
    () =>
      (query.data ?? []).filter(mailbox => isInTeamMailbox(mailbox, address)),
    [query.data, address]
  )
  const root = findTeamMailboxRoot(folders, address)
  // The root is the mailbox itself, its folders the top level
  const tree = useMemo(
    () =>
      buildMailboxTree(folders).find(node => node.mailbox.id === root?.id)
        ?.children ?? [],
    [folders, root?.id]
  )
  const selectedAncestors = useMemo(
    () =>
      new Set(selectedId === null ? [] : findAncestorIds(folders, selectedId)),
    [folders, selectedId]
  )
  const isExpanded = (mailboxId: string): boolean =>
    toggled[mailboxId] ?? selectedAncestors.has(mailboxId)
  const rows = listVisibleMailboxes(tree, isExpanded)

  const handleToggle = (mailboxId: string, expanded: boolean): void => {
    setToggled(previous => ({ ...previous, [mailboxId]: !expanded }))
  }
  const handleOpenMenu = (
    mailbox: MailboxSummary,
    anchor: FolderMenuAnchor
  ): void => {
    setMenu({ mailbox, anchor })
  }
  const handleCloseMenu = (): void => {
    setMenu(null)
  }

  let content: ReactElement | ReactElement[]
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
        onOpenMenu={handleOpenMenu}
      />
    ))
  }

  // The title stays outside the tree: a tree only holds tree items
  return (
    <>
      <NavSectionHeader
        title={root?.name ?? address}
        titleId={titleId}
        data-testid="team-mailbox-title"
      />
      <NavTree
        role="tree"
        aria-labelledby={titleId}
        aria-busy={query.isPending}
        data-testid="mailbox-tree"
      >
        {content}
      </NavTree>
      <FolderActionsMenu
        mailbox={menu?.mailbox ?? null}
        anchor={menu?.anchor ?? null}
        onClose={handleCloseMenu}
      />
    </>
  )
}
