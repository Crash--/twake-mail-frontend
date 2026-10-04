import type { MailboxListData, MailboxSummary } from './queries'

/** What changed among the mailboxes since the state of the cache */
export interface MailboxChanges {
  /** Created and updated mailboxes */
  changed: readonly MailboxSummary[]
  /** Destroyed mailboxes, and changed ones the server no longer finds */
  destroyed: readonly string[]
  oldState: string
  newState: string
}

/**
 * Applies `changes` to the cached mailboxes: replaces the updated ones,
 * adds the created ones, removes the destroyed ones. The data keeps its
 * state when it is no longer the one the changes start from (refetched in
 * the meantime): a later synchronization catches it up.
 */
export function patchMailboxes(
  data: MailboxListData,
  { changed, destroyed, oldState, newState }: MailboxChanges
): MailboxListData {
  const destroyedIds = new Set(destroyed)
  const changedById = new Map(changed.map(mailbox => [mailbox.id, mailbox]))
  const list = data.list
    .filter(mailbox => !destroyedIds.has(mailbox.id))
    .map(mailbox => changedById.get(mailbox.id) ?? mailbox)
  const known = new Set(list.map(mailbox => mailbox.id))
  for (const mailbox of changed) {
    if (!known.has(mailbox.id) && !destroyedIds.has(mailbox.id)) {
      list.push(mailbox)
    }
  }
  return {
    state: data.state === oldState ? newState : data.state,
    list
  }
}
