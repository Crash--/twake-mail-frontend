import { hasKeyword, SEEN } from '@common/features/email/keywords'

import type { EmailListItemData } from './queries'

/**
 * Where a conversation is opened from, kept in the state of the navigation:
 * - `list`: the row of a folder (or label, starred): the message to read
 *   is the first unread one, otherwise the latest;
 * - absent: a search result or a link to an email: that email.
 */
export interface ConversationOpenState {
  conversationTarget: 'list'
}

export const OPENED_FROM_LIST = {
  conversationTarget: 'list'
} as const satisfies ConversationOpenState

export function isOpenedFromList(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'conversationTarget' in state &&
    state.conversationTarget === 'list'
  )
}

/**
 * The message a conversation opens on (scrolled to, focused), as
 * tmail-flutter expands it (`focusExpandedEmail`): from a list, the first
 * unread message, otherwise the latest; otherwise the email opened.
 * `emails` are the messages of the conversation, the oldest first, and are
 * not empty.
 */
export function pickTargetMessageId(
  emails: readonly Pick<EmailListItemData, 'id' | 'keywords'>[],
  openedId: string,
  fromList: boolean
): string {
  const latest = emails[emails.length - 1]?.id ?? openedId
  if (!fromList) {
    return emails.some(email => email.id === openedId) ? openedId : latest
  }
  return emails.find(email => !hasKeyword(email, SEEN))?.id ?? latest
}
