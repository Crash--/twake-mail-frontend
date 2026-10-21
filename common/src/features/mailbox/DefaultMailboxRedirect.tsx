import { Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Navigate } from 'react-router'

import { Folder } from '@/ds/FlutterIcons/FlutterIcons'
import { ViewErrorScreen } from '@common/components/ViewErrorScreen'
import {
  useTeamMailboxEmbed,
  useTeamMailboxScope
} from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { findTeamInboxId } from '@common/features/teamMailboxEmbed/teamMailbox'
import { EmailListPageSkeleton } from '@common/features/thread/EmailListSkeleton'
import { useI18n } from '@common/i18n/useI18n'

import { findMailboxIdByRole } from './mailboxTree'
import { useMailboxes } from './useMailboxes'

/**
 * The page the app opens on: the inbox, resolved from the mailboxes. In the
 * facade of a team mailbox, or bound to one by the mailbox switcher, its
 * Inbox, never the folders of the user.
 */
export function DefaultMailboxRedirect(): ReactElement {
  const { t } = useI18n()
  const query = useMailboxes()
  const teamRootId = useTeamMailboxScope()
  const isFacade = useTeamMailboxEmbed() !== null

  if (query.isPending) return <EmailListPageSkeleton />

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return (
      <ViewErrorScreen
        title={t('common.errorOccurred')}
        documentTitle={t('common.errorTitle')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="mailboxes-error"
      />
    )
  }

  if (teamRootId !== null) {
    const teamInboxId = findTeamInboxId(query.data, teamRootId)
    if (teamInboxId === null) {
      // Picked in the switcher of the webmail: gone (the user left it),
      // the switcher gives the user's own mailbox back
      if (!isFacade) return <EmailListPageSkeleton />
      return (
        <ViewErrorScreen
          title={t('teamMailboxEmbed.unavailableTitle')}
          description={t('teamMailboxEmbed.unavailableDescription')}
          data-testid="team-mailbox-unavailable"
        />
      )
    }
    return (
      <Navigate to={`/mailbox/${encodeURIComponent(teamInboxId)}`} replace />
    )
  }

  const mailboxId =
    findMailboxIdByRole(query.data, 'inbox') ?? query.data[0]?.id ?? null
  if (mailboxId === null) {
    return <Empty icon={Folder} title={t('mailbox.empty')} />
  }
  return <Navigate to={`/mailbox/${encodeURIComponent(mailboxId)}`} replace />
}
