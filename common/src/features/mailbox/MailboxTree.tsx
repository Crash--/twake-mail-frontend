import { Eye, EyeClosed, Magnifier, Plus } from '@linagora/twake-icons'
import {
  Box,
  ListItem,
  ListItemSkeleton,
  ListItemText
} from '@linagora/twake-mui'
import {
  Fragment,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { useMatch } from 'react-router'

import { NavSectionAction } from '@/ds/NavSectionAction/NavSectionAction'
import { NavSectionHeader } from '@/ds/NavSectionHeader/NavSectionHeader'
import { NavTree } from '@/ds/NavTree/NavTree'
import {
  FolderActionsMenu,
  type FolderMenuAnchor
} from '@common/features/mailboxActions/FolderActionsMenu'
import { useFolderActions } from '@common/features/mailboxActions/FolderActionsProvider'
import { useAiNeedsActionEnabled } from '@common/features/ai/aiNeedsAction'
import { useI18n } from '@common/i18n/useI18n'

import {
  buildMailboxSections,
  findAncestorIds,
  listVisibleMailboxes,
  splitPersonalTree,
  type VisibleMailbox
} from './mailboxTree'
import { MailboxSearch } from './MailboxSearch'
import { MailboxTreeItem } from './MailboxTreeItem'
import { useSidebarSections } from './SidebarSectionsProvider'
import type { MailboxSummary } from './queries'
import { ActionRequiredTreeItem } from './ActionRequiredTreeItem'
import { StarredTreeItem } from './StarredTreeItem'
import { useMailboxes } from './useMailboxes'

const SKELETON_ROWS = [1, 2, 3, 4, 5]

interface TreeRowsProps {
  rows: readonly VisibleMailbox[]
  selectedId: string | null
  onToggle: (mailboxId: string, isExpanded: boolean) => void
  onOpenMenu: (mailbox: MailboxSummary, anchor: FolderMenuAnchor) => void
  /** Puts the Starred virtual folder after the Inbox and its subfolders */
  withStarred?: boolean
  /** Puts the Action required virtual folder after Starred */
  withActionRequired?: boolean
}

function TreeRows({
  rows,
  selectedId,
  onToggle,
  onOpenMenu,
  withStarred = false,
  withActionRequired = false
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
  // Starred and Action required take a place among the top level folders
  const virtualCount = withActionRequired ? 2 : 1
  const shift = (row: VisibleMailbox): VisibleMailbox =>
    starredAt === null || row.level !== 1
      ? row
      : {
          ...row,
          position:
            row.position > starredAt
              ? row.position + virtualCount
              : row.position,
          siblingCount: row.siblingCount + virtualCount
        }
  const starredItem =
    inbox !== undefined && starredAt !== null ? (
      <>
        <StarredTreeItem
          position={starredAt + 1}
          siblingCount={inbox.siblingCount + virtualCount}
        />
        {withActionRequired ? (
          <ActionRequiredTreeItem
            position={starredAt + 2}
            siblingCount={inbox.siblingCount + virtualCount}
          />
        ) : null}
      </>
    ) : null
  return (
    <>
      {rows.map((row, index) => (
        <Fragment key={row.mailbox.id}>
          {index === starredBefore ? starredItem : null}
          <MailboxTreeItem
            row={shift(row)}
            isSelected={row.mailbox.id === selectedId}
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
  const foldersContentId = useId()
  const teamContentId = useId()
  const collapsible = useSidebarSections()
  const query = useMailboxes()
  const folderActions = useFolderActions()
  const isActionRequiredOn = useAiNeedsActionEnabled()
  const match = useMatch('/mailbox/:mailboxId/*')
  const selectedId = match?.params.mailboxId ?? null
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [showHidden, setShowHidden] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const searchId = useId()
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
  const personal = useMemo(
    () => splitPersonalTree(sections.personal),
    [sections.personal]
  )
  const systemRows = listVisibleMailboxes(personal.system, isExpanded)
  const folderRows = listVisibleMailboxes(personal.folders, isExpanded)
  const teamRows = listVisibleMailboxes(sections.team, isExpanded)

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
  const handleToggleSearch = (): void => {
    setIsSearching(searching => !searching)
  }
  const handleCloseSearch = (): void => {
    setIsSearching(false)
    searchButtonRef.current?.focus()
  }
  const handleToggleHidden = (): void => {
    setShowHidden(shown => !shown)
  }

  let systemContent: ReactNode
  if (query.isPending) {
    systemContent = SKELETON_ROWS.map(row => <ListItemSkeleton key={row} />)
  } else if (query.isError) {
    systemContent = (
      <ListItem data-testid="mailbox-tree-error">
        <ListItemText secondary={t('common.errorOccurred')} />
      </ListItem>
    )
  } else {
    systemContent = (
      <TreeRows
        rows={systemRows}
        selectedId={selectedId}
        onToggle={handleToggle}
        onOpenMenu={handleOpenMenu}
        withStarred
        withActionRequired={isActionRequiredOn}
      />
    )
  }

  const searchLabel = t('folders.search.label')
  const newFolderLabel = t('folders.newFolder')
  const hiddenLabel = t('folders.hidden.show')

  // The titles stay outside the trees: a tree only holds tree items
  return (
    <>
      {isSearching ? null : (
        <NavTree
          role="tree"
          aria-label={t('sidebar.mailboxes')}
          aria-busy={query.isPending}
          data-testid="mailbox-tree"
        >
          {systemContent}
        </NavTree>
      )}
      <NavSectionHeader
        title={t('sidebar.folders')}
        titleId={titleId}
        toggle={{
          isExpanded: collapsible.isExpanded('folders'),
          onToggle: () => {
            collapsible.toggle('folders')
          },
          controlsId: isSearching ? searchId : foldersContentId,
          'data-testid': 'folders-section-toggle'
        }}
        data-testid="mailbox-tree-title"
        actions={
          <>
            {sections.hiddenCount > 0 ? (
              <NavSectionAction
                label={hiddenLabel}
                icon={showHidden ? Eye : EyeClosed}
                aria-pressed={showHidden}
                onClick={handleToggleHidden}
                data-testid="show-hidden-folders-button"
              />
            ) : null}
            <NavSectionAction
              buttonRef={searchButtonRef}
              label={searchLabel}
              icon={Magnifier}
              aria-expanded={isSearching}
              aria-controls={isSearching ? searchId : undefined}
              onClick={handleToggleSearch}
              data-testid="mailbox-search-button"
            />
            <NavSectionAction
              label={newFolderLabel}
              icon={Plus}
              onClick={handleCreate}
              data-testid="add-new-folder-button"
            />
          </>
        }
      />
      {isSearching ? (
        <MailboxSearch
          id={searchId}
          selectedId={selectedId}
          onClose={handleCloseSearch}
          onOpenMenu={handleOpenMenu}
        />
      ) : (
        <div id={foldersContentId} hidden={!collapsible.isExpanded('folders')}>
          {folderRows.length > 0 ? (
            <NavTree
              role="tree"
              aria-labelledby={titleId}
              data-testid="mailbox-folders-tree"
            >
              <TreeRows
                rows={folderRows}
                selectedId={selectedId}
                onToggle={handleToggle}
                onOpenMenu={handleOpenMenu}
              />
            </NavTree>
          ) : null}
        </div>
      )}
      {teamRows.length > 0 && !isSearching ? (
        <Box data-testid="team-mailboxes-section">
          <NavSectionHeader
            title={t('sidebar.teamMailboxes')}
            titleId={teamTitleId}
            toggle={{
              isExpanded: collapsible.isExpanded('teamMailboxes'),
              onToggle: () => {
                collapsible.toggle('teamMailboxes')
              },
              controlsId: teamContentId,
              'data-testid': 'team-mailboxes-section-toggle'
            }}
          />
          <div
            id={teamContentId}
            hidden={!collapsible.isExpanded('teamMailboxes')}
          >
            <NavTree role="tree" aria-labelledby={teamTitleId}>
              <TreeRows
                rows={teamRows}
                selectedId={selectedId}
                onToggle={handleToggle}
                onOpenMenu={handleOpenMenu}
              />
            </NavTree>
          </div>
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
