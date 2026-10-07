import { Eye, EyeClosed, Icon } from '@linagora/twake-icons'
import { Box, Button, List, ListItem, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import { useFolderActions } from '@common/features/mailboxActions/FolderActionsProvider'
import type { SettingsSection } from '@common/features/settings/sections'
import { SettingsSectionLayout } from '@common/features/settings/SettingsSectionLayout'
import { useI18n } from '@common/i18n/useI18n'

import {
  buildMailboxSections,
  isPersonalMailbox,
  isTeamRoot,
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

function FolderRows({
  nodes
}: {
  nodes: readonly MailboxNode[]
}): ReactElement {
  const { t } = useI18n()
  const getName = useMailboxName()
  const { run } = useFolderActions()

  return (
    <>
      {nodes.map(node => {
        const { mailbox } = node
        const isHidden = !mailbox.isSubscribed
        const name = getName(mailbox)
        return (
          <ListItem
            key={mailbox.id}
            divider
            className="u-flex-column u-flex-items-stretch u-pr-0"
            data-testid="folder-visibility-item"
            data-mailbox-name={mailbox.name}
            data-hidden={isHidden || undefined}
          >
            <Box className="u-flex u-flex-items-center">
              {isHidden ? (
                <SecondaryText className="u-flex-auto u-breakword">
                  {name}
                </SecondaryText>
              ) : (
                <Typography className="u-flex-auto u-breakword">
                  {name}
                </Typography>
              )}
              {isTeamRoot(mailbox) ? (
                <SecondaryText
                  variant="caption"
                  className="u-mr-1 u-breakword"
                  data-testid="folder-visibility-address"
                >
                  {teamMailboxAddress(mailbox)}
                </SecondaryText>
              ) : null}
              {canHide(node) ? (
                <Button
                  variant="text"
                  color="inherit"
                  startIcon={<Icon icon={isHidden ? Eye : EyeClosed} />}
                  aria-label={t(
                    isHidden
                      ? 'folders.visibility.showOf'
                      : 'folders.visibility.hideOf',
                    { name }
                  )}
                  onClick={() => {
                    run(isHidden ? 'show' : 'hide', mailbox)
                  }}
                  data-testid="folder-visibility-toggle"
                >
                  {t(
                    isHidden
                      ? 'folders.visibility.show'
                      : 'folders.visibility.hide'
                  )}
                </Button>
              ) : null}
            </Box>
            {node.children.length > 0 ? (
              <List disablePadding className="u-pl-1">
                <FolderRows nodes={node.children} />
              </List>
            ) : null}
          </ListItem>
        )
      })}
    </>
  )
}

export interface FolderVisibilitySettingsProps {
  section: SettingsSection
}

/**
 * Settings > Folder visibility, as tmail-flutter: every folder, the user's
 * own and the team mailboxes, each of them hidden or shown again
 * (`isSubscribed`, with their subfolders, or with their parents)
 */
export function FolderVisibilitySettings({
  section
}: FolderVisibilitySettingsProps): ReactElement {
  const { t } = useI18n()
  const { data: mailboxes } = useMailboxes()

  if (!mailboxes) {
    return (
      <SettingsSectionLayout section={section}>
        <LoadingListSkeleton count={5} />
      </SettingsSectionLayout>
    )
  }

  const { personal, team } = buildMailboxSections(mailboxes, true)

  return (
    <SettingsSectionLayout section={section}>
      <Typography variant="subtitle1" component="h2" className="u-fw-bold">
        {t('folders.visibility.personal')}
      </Typography>
      <List
        aria-label={t('folders.visibility.personal')}
        data-testid="folder-visibility-personal"
      >
        <FolderRows nodes={personal} />
      </List>
      {team.length > 0 ? (
        <>
          <Typography
            variant="subtitle1"
            component="h2"
            className="u-fw-bold u-mt-1"
          >
            {t('folders.visibility.team')}
          </Typography>
          <List
            aria-label={t('folders.visibility.team')}
            data-testid="folder-visibility-team"
          >
            <FolderRows nodes={team} />
          </List>
        </>
      ) : null}
    </SettingsSectionLayout>
  )
}
