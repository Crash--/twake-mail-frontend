import { EyeClosed, Eye, Icon, Lock } from '@linagora/twake-icons'
import { Box, Typography } from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

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

/** The system folders (Inbox, Sent…) are always in the sidebar */
function isAlwaysVisible(node: MailboxNode): boolean {
  return isPersonalMailbox(node.mailbox) && node.mailbox.role !== null
}

function AlwaysVisible(): ReactElement {
  const { t } = useI18n()
  return (
    <Box
      component="span"
      className="u-flex u-flex-items-center u-flex-shrink-0"
      data-testid="folder-visibility-always-visible"
    >
      <Icon icon={Lock} size={16} aria-hidden="true" />
      <Typography
        variant="caption"
        component="span"
        color="textPrimary"
        className="u-ml-half"
      >
        {t('folders.visibility.alwaysVisible')}
      </Typography>
    </Box>
  )
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
        const state = t(
          isHidden ? 'folders.visibility.hidden' : 'folders.visibility.visible'
        )
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
                  text={state}
                  // Starts with the state shown, then says what a click does
                  label={t('folders.visibility.stateAction', {
                    state,
                    action: t(
                      isHidden
                        ? 'folders.visibility.showOf'
                        : 'folders.visibility.hideOf',
                      { name }
                    )
                  })}
                  icon={isHidden ? EyeClosed : Eye}
                  onClick={() => {
                    run(isHidden ? 'show' : 'hide', mailbox)
                  }}
                  data-testid="folder-visibility-toggle"
                />
              ) : isAlwaysVisible(node) ? (
                <AlwaysVisible />
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

interface FolderGroupProps {
  title: string
  isFirst?: boolean
  children: ReactElement
  'data-testid': string
}

/** A heading and its list of folders */
function FolderGroup({
  title,
  isFirst = false,
  children,
  'data-testid': testId
}: FolderGroupProps): ReactElement {
  const titleId = useId()
  return (
    <Box component="section" aria-labelledby={titleId}>
      <Typography
        id={titleId}
        variant="caption"
        component="h2"
        color="textSecondary"
        className={isFirst ? 'u-mb-half' : 'u-mt-1 u-mb-half'}
      >
        {title}
      </Typography>
      <PlainList label={title} data-testid={testId}>
        {children}
      </PlainList>
    </Box>
  )
}

export interface FolderVisibilitySettingsProps {
  section: SettingsSection
}

/**
 * Settings > Folder visibility, as the Figma: the system folders, always
 * visible, then the "Folders" heading folding the user's own folders and the
 * team mailboxes, each under its own folding heading. Each folder the user
 * made, and each team mailbox, is hidden or shown again (`isSubscribed`, with
 * their subfolders, or with their parents).
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
        <FolderGroup
          title={t('sidebar.mailboxes')}
          isFirst
          data-testid="folder-visibility-personal"
        >
          {rows(system)}
        </FolderGroup>
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
                isExpanded={isPersonalExpanded}
                onToggle={() => {
                  setPersonalExpanded(current => !current)
                }}
                controlsId={`${baseId}-personal`}
                headingLevel="h3"
                isList
                data-testid="folder-visibility-folders"
              >
                {rows(folders)}
              </CollapsibleCategory>
            )}
            {team.length === 0 ? null : (
              <CollapsibleCategory
                title={t('folders.visibility.team')}
                isExpanded={isTeamExpanded}
                onToggle={() => {
                  setTeamExpanded(current => !current)
                }}
                controlsId={`${baseId}-team`}
                headingLevel="h3"
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
