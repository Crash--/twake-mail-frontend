import type { EmailChanges } from './patchEmailList'
import { byReceivedAt, type ConversationData } from './queries'

/**
 * Applies `changes` to a conversation: its emails are replaced (keywords,
 * mailboxes), a new email of the thread joins it in date order (a reply
 * arriving while it is open), a destroyed one leaves it. The conversation
 * takes the new state of the state it was at.
 */
export function patchConversation(
  data: ConversationData,
  threadId: string,
  { changed, destroyed, newStates }: EmailChanges
): ConversationData {
  const destroyedIds = new Set(destroyed)
  const byId = new Map(
    data.emails
      .filter(email => !destroyedIds.has(email.id))
      .map(email => [email.id, email])
  )
  for (const email of changed) {
    if (email.threadId === threadId) byId.set(email.id, email)
  }
  return {
    state: newStates.get(data.state) ?? data.state,
    emails: [...byId.values()].sort(byReceivedAt)
  }
}
