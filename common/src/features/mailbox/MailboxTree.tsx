import { Eye, EyeClosed, Icon, Plus } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  ListItem,
  ListItemSkeleton,
  ListItemText,
  Nav,
  Tooltip
} from '@linagora/twake-mui'
import {
  Fragment,
  useId,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { useMatch } from 'react-router'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import {
  FolderActionsMenu,
  type FolderMenuAnchor
} from '@common/features/mailboxActions/FolderActionsMenu'
import { useFolderActions } from '@common/features/mailboxActions/FolderActionsProvider'
import { useI18n } from '@common/i18n/useI18n'

import {
  buildMailboxSections,
  findAncestorIds,
  listVisibleMailboxes,
  type MailboxNode,
  type VisibleMailbox
} from './mailboxTree'
import { MailboxTreeItem } from './MailboxTreeItem'
import type { MailboxSummary } from './queries'
import { StarredTreeItem } from './StarredTreeItem'
import { useMailboxes } from './useMailboxes'

const SKELETON_ROWS = [1, 2, 3, 4, 5]

function hasSubfolders(node: MailboxNode): boolean {
  return node.children.length > 0
}

interface TreeRowsProps {
  rows: readonly VisibleMailbox[]
  selectedId: string | null
  hasToggleSlot: boolean
  onToggle: (mailboxId: string, isExpanded: boolean) => void
  onOpenMenu: (mailbox: MailboxSummary, anchor: FolderMenuAnchor) => void
  /** Puts the Starred virtual folder after the Inbox and its subfolders */
  withStarred?: boolean
}

function TreeRows({
  rows,
  selectedId,
  hasToggleSlot,
  onToggle,
  onOpenMenu,
  withStarred = false
}: TreeRowsProps): ReactElement {
  const inbox = rows.find(
    row => row.level === 1 && row.mailbox.role === 'inbox'
  )
  const starredAt = withStarred && inbox !== undefined ? inbox.position : null
  // The Starred folder comes after the whole subtree of the Inbox
  const inboxIndex = inbox === undefined ? -1 : rows.indexOf(inbox)
  const nextTopLevel = rows.findIndex(
    (row, index) => index > inboxIndex && row.level === 1
  )
  const starredBefore = nextTopLevel === -1 ? rows.length : nextTopLevel
  // The Starred folder takes a place among the top level folders
  const shift = (row: VisibleMailbox): VisibleMailbox =>
    starredAt === null || row.level !== 1
      ? row
      : {
          ...row,
          position: row.position > starredAt ? row.position + 1 : row.position,
          siblingCount: row.siblingCount + 1
        }
  const starredItem =
    inbox !== undefined && starredAt !== null ? (
      <StarredTreeItem
        position={starredAt + 1}
        siblingCount={inbox.siblingCount + 1}
        hasToggleSlot={hasToggleSlot}
      />
    ) : null
  return (
    <>
      {rows.map((row, index) => (
        <Fragment key={row.mailbox.id}>
          {index === starredBefore ? starredItem : null}
          <MailboxTreeItem
            row={shift(row)}
            isSelected={row.mailbox.id === selectedId}
            hasToggleSlot={hasToggleSlot}
            onToggle={onToggle}
            onOpenMenu={onOpenMenu}
          />
        </Fragment>
      ))}
      {starredBefore === rows.length ? starredItem : null}
    </>
  )
}

/**
 * The folder trees of the sidebar: the folders of the user (with the
 * Starred virtual folder after the Inbox), then, when the user belongs to
 * team mailboxes, a "Team-mailboxes" section. Folders are collapsed, except
 * the ones leading to the selected folder, until the user toggles them.
 * Hidden folders show on demand; "+" creates a folder.
 */
export function MailboxTree(): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const teamTitleId = useId()
  const query = useMailboxes()
  const folderActions = useFolderActions()
  const match = useMatch('/mailbox/:mailboxId/*')
  const selectedId = match?.params.mailboxId ?? null
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [showHidden, setShowHidden] = useState(false)
  const [menu, setMenu] = useState<{
    mailbox: MailboxSummary
    anchor: FolderMenuAnchor
  } | null>(null)

  const sections = useMemo(
    () => buildMailboxSections(query.data ?? [], showHidden),
    [query.data, showHidden]
  )
  const selectedAncestors = useMemo(
    () =>
      new Set(
        selectedId === null ? [] : findAncestorIds(query.data ?? [], selectedId)
      ),
    [query.data, selectedId]
  )
  const isExpanded = (mailboxId: string): boolean =>
    toggled[mailboxId] ?? selectedAncestors.has(mailboxId)
  const personalRows = listVisibleMailboxes(sections.personal, isExpanded)
  const teamRows = listVisibleMailboxes(sections.team, isExpanded)
  // Without any subfolder, no row needs room for an expand arrow
  const hasToggleSlot =
    sections.personal.some(hasSubfolders) || sections.team.some(hasSubfolders)

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
  const handleCreate = (): void => {
    folderActions.create(null)
  }
  const handleToggleHidden = (): void => {
    setShowHidden(shown => !shown)
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
    content = (
      <TreeRows
        rows={personalRows}
        selectedId={selectedId}
        hasToggleSlot={hasToggleSlot}
        onToggle={handleToggle}
        onOpenMenu={handleOpenMenu}
        withStarred
      />
    )
  }

  const newFolderLabel = t('folders.newFolder')
  const hiddenLabel = t('folders.hidden.show')

  // The titles stay outside the trees: a tree only holds tree items
  return (
    <>
      <Box className="u-flex u-flex-items-center u-pr-half">
        <SecondaryText
          variant="subtitle2"
          component="h2"
          className="u-flex-auto u-ph-1 u-pv-half"
          data-testid="mailbox-tree-title"
        >
          <span id={titleId}>{t('sidebar.folders')}</span>
        </SecondaryText>
        {sections.hiddenCount > 0 ? (
          <Tooltip title={hiddenLabel}>
            <IconButton
              size="small"
              aria-label={hiddenLabel}
              aria-pressed={showHidden}
              onClick={handleToggleHidden}
              data-testid="show-hidden-folders-button"
            >
              <Icon icon={showHidden ? Eye : EyeClosed} />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip title={newFolderLabel}>
          <IconButton
            size="small"
            aria-label={newFolderLabel}
            onClick={handleCreate}
            data-testid="add-new-folder-button"
          >
            <Icon icon={Plus} />
          </IconButton>
        </Tooltip>
      </Box>
      <Nav
        role="tree"
        aria-labelledby={titleId}
        aria-busy={query.isPending}
        data-testid="mailbox-tree"
      >
        {content}
      </Nav>
      {teamRows.length > 0 ? (
        <Box data-testid="team-mailboxes-section">
          <SecondaryText
            variant="subtitle2"
            component="h2"
            className="u-ph-1 u-pv-half u-mt-half"
          >
            <span id={teamTitleId}>{t('sidebar.teamMailboxes')}</span>
          </SecondaryText>
          <Nav role="tree" aria-labelledby={teamTitleId}>
            <TreeRows
              rows={teamRows}
              selectedId={selectedId}
              hasToggleSlot={hasToggleSlot}
              onToggle={handleToggle}
              onOpenMenu={handleOpenMenu}
            />
          </Nav>
        </Box>
      ) : null}
      <FolderActionsMenu
        mailbox={menu?.mailbox ?? null}
        anchor={menu?.anchor ?? null}
        onClose={handleCloseMenu}
      />
    </>
  )
}
