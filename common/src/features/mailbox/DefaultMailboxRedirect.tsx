import { Folder } from '@linagora/twake-icons'
import { Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Navigate } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useTeamMailboxEmbed } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { findTeamInboxId } from '@common/features/teamMailboxEmbed/teamMailbox'
import { useI18n } from '@common/i18n/useI18n'

import { findMailboxIdByRole } from './mailboxTree'
import { useMailboxes } from './useMailboxes'

/**
 * The page the app opens on: the inbox, resolved from the mailboxes. In the
 * facade of a team mailbox, its Inbox, never the folders of the user.
 */
export function DefaultMailboxRedirect(): ReactElement {
  const { t } = useI18n()
  const query = useMailboxes()
  const teamRootId = useTeamMailboxEmbed()

  if (query.isPending) return <FullPageLoader />

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="mailboxes-error"
      />
    )
  }

  if (teamRootId !== null) {
    const teamInboxId = findTeamInboxId(query.data, teamRootId)
    if (teamInboxId === null) {
      return (
        <ErrorScreen
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
