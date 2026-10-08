import { useId, useState, type ReactElement } from 'react'

import { FolderOutlined } from '@/ds/FlutterIcons/FlutterIcons'
import {
  HideMailbox,
  ShowMailbox
} from '@/ds/FlutterIcons/MailboxVisibilityIcons'
import { CollapsibleCategory } from '@/ds/CollapsibleCategory/CollapsibleCategory'
import { FolderVisibilityRow } from '@/ds/FolderVisibilityRow/FolderVisibilityRow'
import { NarrowColumn } from '@/ds/NarrowColumn/NarrowColumn'
import { PlainList } from '@/ds/PlainList/PlainList'
import { VisibilityToggleButton } from '@/ds/VisibilityToggleButton/VisibilityToggleButton'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import { useFolderActions } from '@common/features/mailboxActions/FolderActionsProvider'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useI18n } from '@common/i18n/useI18n'

import { getMailboxIcon } from './mailboxDisplay'
import {
  buildMailboxSections,
  isPersonalMailbox,
  isTeamRoot,
  splitPersonalTree,
  teamMailboxAddress,
  type MailboxNode
} from './mailboxTree'
import { useMailboxes } from './useMailboxes'
import { useMailboxName } from './useMailboxName'

/** The folders the user can hide: their own (no role), the team mailboxes */
function canHide(node: MailboxNode): boolean {
  const { mailbox } = node
  return isPersonalMailbox(mailbox)
    ? mailbox.role === null
    : mailbox.parentId === null
}

interface FolderRowsProps {
  nodes: readonly MailboxNode[]
  expandedIds: ReadonlySet<string>
  onToggleExpanded: (id: string) => void
}

/**
 * The rows of folders and, under an expanded one, of its subfolders, as
 * tmail-flutter's tree: collapsed until the user expands them
 */
function FolderRows({
  nodes,
  expandedIds,
  onToggleExpanded
}: FolderRowsProps): ReactElement {
  const { t } = useI18n()
  const getName = useMailboxName()
  const { run } = useFolderActions()
  const listId = useId()

  return (
    <>
      {nodes.map(node => {
        const { mailbox } = node
        const isHidden = !mailbox.isSubscribed
        const name = getName(mailbox)
        const isExpanded = expandedIds.has(mailbox.id)
        const isTeamMailbox = isTeamRoot(mailbox)
        return (
          <FolderVisibilityRow
            key={mailbox.id}
            name={name}
            // As tmail-flutter: a team mailbox shows its address instead
            icon={isTeamMailbox ? null : getMailboxIcon(mailbox)}
            isMuted={isHidden && mailbox.role === null}
            secondary={isTeamMailbox ? teamMailboxAddress(mailbox) : null}
            secondaryTestId="folder-visibility-address"
            expand={
              node.children.length === 0
                ? null
                : {
                    isExpanded,
                    label: t(
                      isExpanded ? 'mailbox.collapse' : 'mailbox.expand'
                    ),
                    onToggle: () => {
                      onToggleExpanded(mailbox.id)
                    },
                    controlsId: `${listId}-${mailbox.id}`,
                    'data-testid': 'folder-visibility-expand-button'
                  }
            }
            action={
              canHide(node) ? (
                <VisibilityToggleButton
                  text={t(
                    isHidden
                      ? 'folders.visibility.show'
                      : 'folders.visibility.hide'
                  )}
                  label={t(
                    isHidden
                      ? 'folders.visibility.showOf'
                      : 'folders.visibility.hideOf',
                    { name }
                  )}
                  icon={isHidden ? ShowMailbox : HideMailbox}
                  onClick={() => {
                    run(isHidden ? 'show' : 'hide', mailbox)
                  }}
                  data-testid="folder-visibility-toggle"
                />
              ) : null
            }
            data-testid="folder-visibility-item"
            dataAttributes={{
              'data-mailbox-name': mailbox.name,
              ...(isHidden ? { 'data-hidden': 'true' } : {})
            }}
          >
            <FolderRows
              nodes={node.children}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
            />
          </FolderVisibilityRow>
        )
      })}
    </>
  )
}

export interface FolderVisibilitySettingsProps {
  section: SettingsSection
}

/**
 * Settings > Folder visibility, as tmail-flutter: the system folders, then
 * the "Folders" bar folding the user's own folders and the team mailboxes,
 * in a 315 px column. Each folder the user made, and each team mailbox, is
 * hidden or shown again (`isSubscribed`, with their subfolders, or with
 * their parents).
 */
export function FolderVisibilitySettings({
  section
}: FolderVisibilitySettingsProps): ReactElement {
  const { t } = useI18n()
  const { data: mailboxes } = useMailboxes()
  const baseId = useId()
  const [areFoldersExpanded, setFoldersExpanded] = useState(true)
  const [isPersonalExpanded, setPersonalExpanded] = useState(true)
  const [isTeamExpanded, setTeamExpanded] = useState(true)
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )

  if (!mailboxes) {
    return (
      <SettingsSectionLayout section={section}>
        <LoadingListSkeleton count={5} />
      </SettingsSectionLayout>
    )
  }

  const { personal, team } = buildMailboxSections(mailboxes, true)
  const { system, folders } = splitPersonalTree(personal)
  const handleToggleExpanded = (id: string): void => {
    setExpandedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const rows = (nodes: readonly MailboxNode[]): ReactElement => (
    <FolderRows
      nodes={nodes}
      expandedIds={expandedIds}
      onToggleExpanded={handleToggleExpanded}
    />
  )

  return (
    <SettingsSectionLayout section={section}>
      <NarrowColumn>
        <PlainList
          label={t('sidebar.mailboxes')}
          data-testid="folder-visibility-personal"
        >
          {rows(system)}
        </PlainList>
        {folders.length === 0 && team.length === 0 ? null : (
          <CollapsibleCategory
            title={t('sidebar.folders')}
            isExpanded={areFoldersExpanded}
            onToggle={() => {
              setFoldersExpanded(current => !current)
            }}
            controlsId={`${baseId}-folders`}
            toggleTestId="folder-visibility-folders-toggle"
          >
            {folders.length === 0 ? null : (
              <CollapsibleCategory
                title={t('folders.visibility.personal')}
                icon={FolderOutlined}
                isExpanded={isPersonalExpanded}
                onToggle={() => {
                  setPersonalExpanded(current => !current)
                }}
                controlsId={`${baseId}-personal`}
                inset={10}
                isList
                data-testid="folder-visibility-folders"
              >
                {rows(folders)}
              </CollapsibleCategory>
            )}
            {team.length === 0 ? null : (
              <CollapsibleCategory
                title={t('folders.visibility.team')}
                icon={FolderOutlined}
                isExpanded={isTeamExpanded}
                onToggle={() => {
                  setTeamExpanded(current => !current)
                }}
                controlsId={`${baseId}-team`}
                inset={10}
                isList
                data-testid="folder-visibility-team"
              >
                {rows(team)}
              </CollapsibleCategory>
            )}
          </CollapsibleCategory>
        )}
      </NarrowColumn>
    </SettingsSectionLayout>
  )
}
