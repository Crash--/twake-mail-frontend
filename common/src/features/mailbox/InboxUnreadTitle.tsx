import { useUnreadCountInTitle } from '@common/app/DocumentTitleProvider'
import { findTeamInboxId } from '@common/features/teamMailboxEmbed/teamMailbox'
import { useTeamMailboxScope } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'

import { findMailboxIdByRole } from './mailboxTree'
import { useMailboxes } from './useMailboxes'

/**
 * Puts the unread count of the Inbox, as the sidebar shows it, before the
 * title of the page: it shows on the tab of the browser, and follows the
 * emails read and received. Bound to a team mailbox (the facade, the
 * mailbox switcher), the Inbox of that team mailbox.
 */
export function InboxUnreadTitle(): null {
  const query = useMailboxes()
  const teamRootId = useTeamMailboxScope()
  const inboxId =
    query.data === undefined
      ? null
      : teamRootId === null
        ? findMailboxIdByRole(query.data, 'inbox')
        : findTeamInboxId(query.data, teamRootId)
  const inbox = query.data?.find(mailbox => mailbox.id === inboxId) ?? null
  useUnreadCountInTitle(inbox?.unreadEmails ?? null)
  return null
}
