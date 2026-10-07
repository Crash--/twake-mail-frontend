import { useUnreadCountInTitle } from '@common/app/DocumentTitleProvider'

import { findMailboxIdByRole } from './mailboxTree'
import { useMailboxes } from './useMailboxes'

/**
 * Puts the unread count of the Inbox, as the sidebar shows it, before the
 * title of the page: it shows on the tab of the browser, and follows the
 * emails read and received
 */
export function InboxUnreadTitle(): null {
  const query = useMailboxes()
  const inboxId =
    query.data === undefined ? null : findMailboxIdByRole(query.data, 'inbox')
  const inbox = query.data?.find(mailbox => mailbox.id === inboxId) ?? null
  useUnreadCountInTitle(inbox?.unreadEmails ?? null)
  return null
}
