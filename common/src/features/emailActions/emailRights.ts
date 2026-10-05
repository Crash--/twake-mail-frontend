import type { MailboxSummary } from '@common/features/mailbox/queries'

import type { EmailActionId } from './emailActionItems'
import type { EmailActionName } from './useEmailActions'
import type { TargetEmail } from './planEmailChanges'

/** What a member may do in a folder (`myRights`) that actions on emails need */
export type EmailRight = 'mayRemoveItems' | 'maySetSeen' | 'maySetKeywords'

const ACTION_RIGHTS: Record<EmailActionName, EmailRight> = {
  archive: 'mayRemoveItems',
  moveToTrash: 'mayRemoveItems',
  moveTo: 'mayRemoveItems',
  markAsSpam: 'mayRemoveItems',
  markAsNotSpam: 'mayRemoveItems',
  deletePermanently: 'mayRemoveItems',
  markAsRead: 'maySetSeen',
  markAsUnread: 'maySetSeen',
  star: 'maySetKeywords',
  unstar: 'maySetKeywords',
  markUnsubscribed: 'maySetKeywords',
  addLabel: 'maySetKeywords',
  removeLabel: 'maySetKeywords',
  setKeyword: 'maySetKeywords'
}

const ITEM_RIGHTS: Record<EmailActionId, EmailRight | null> = {
  'not-spam': 'mayRemoveItems',
  'move-to-trash': 'mayRemoveItems',
  'delete-permanently': 'mayRemoveItems',
  archive: 'mayRemoveItems',
  move: 'mayRemoveItems',
  'mark-as-spam': 'mayRemoveItems',
  'mark-as-read': 'maySetSeen',
  'mark-as-unread': 'maySetSeen',
  star: 'maySetKeywords',
  unstar: 'maySetKeywords',
  'label-as': 'maySetKeywords',
  unsubscribe: 'maySetKeywords',
  // Reading an email is all they need
  print: null,
  'download-eml': null,
  'edit-as-new': null
}

/** The right an action needs on the folders of the emails */
export function rightForAction(action: EmailActionName): EmailRight {
  return ACTION_RIGHTS[action]
}

/** The right a menu item needs on the folders of the emails, if any */
export function rightForItem(id: EmailActionId): EmailRight | null {
  return ITEM_RIGHTS[id]
}

/**
 * Whether the user has `right` on the email: in the folder it is taken
 * from (`from`), or in every folder it is in. A folder the list does not
 * hold is not a refusal.
 */
export function mayOnEmail(
  email: Pick<TargetEmail, 'mailboxIds'>,
  right: EmailRight,
  mailboxes: readonly MailboxSummary[],
  from: string | null = null
): boolean {
  const ids =
    from !== null && from in email.mailboxIds
      ? [from]
      : Object.keys(email.mailboxIds)
  return ids.every(
    id => mailboxes.find(mailbox => mailbox.id === id)?.myRights[right] ?? true
  )
}

/** Whether the user has `right` on every email */
export function mayOnEmails(
  emails: readonly Pick<TargetEmail, 'mailboxIds'>[],
  right: EmailRight,
  mailboxes: readonly MailboxSummary[],
  from: string | null = null
): boolean {
  return emails.every(email => mayOnEmail(email, right, mailboxes, from))
}
