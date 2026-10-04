import type { EmailChanges } from './patchEmailList'
import type { EmailListData, EmailListPage } from './queries'

export interface QueryListPatch {
  data: EmailListData
  /**
   * Only the server can tell what the list holds now: emails it does not
   * list changed (arrived, or were updated elsewhere), or the email
   * standing for a conversation left
   */
  needsRefresh: boolean
}

export interface QueryListScope {
  /** The mailbox the list shows: emails leaving it leave the list */
  mailboxId?: string
  /** One row per conversation (`collapseThreads`) */
  isCollapsed?: boolean
}

/**
 * Applies `changes` to a list the client cannot sort or filter by itself
 * (search results, conversations of a mailbox):
 *
 * - a destroyed email is removed, as one that left the mailbox listed;
 * - a listed email is replaced (keywords, mailboxes) and stays where it is:
 *   archiving or reading a search result shows its new state rather than
 *   making it vanish, as in tmail-flutter;
 * - when an email the list does not show changed, or a conversation lost
 *   the email standing for it, the caller queries the loaded window again
 *   (James has no `Email/queryChanges`).
 *
 * Positions and counts follow, pages take the new state of their state.
 */
export function patchQueryList(
  data: EmailListData,
  { changed, destroyed, newStates }: EmailChanges,
  { mailboxId, isCollapsed = false }: QueryListScope = {}
): QueryListPatch {
  const destroyedIds = new Set(destroyed)
  const changedById = new Map(changed.map(email => [email.id, email]))
  const listed = new Set<string>()
  let position = data.pages[0]?.position ?? 0
  let removed = 0

  const pages = data.pages.map((page): EmailListPage => {
    const emails = page.emails.flatMap(email => {
      if (destroyedIds.has(email.id) || listed.has(email.id)) return []
      listed.add(email.id)
      const update = changedById.get(email.id)
      if (
        update &&
        mailboxId !== undefined &&
        !(mailboxId in update.mailboxIds)
      ) {
        return []
      }
      return [update ?? email]
    })
    const delta = emails.length - page.emails.length
    removed -= delta
    const patched: EmailListPage = {
      ...page,
      emails,
      position,
      count: Math.max(0, page.count + delta),
      state: newStates.get(page.state) ?? page.state
    }
    position += patched.count
    return patched
  })

  return {
    data: {
      pages: pages.map(page => ({
        ...page,
        total: page.total === null ? null : Math.max(0, page.total - removed)
      })),
      pageParams: pages.map(page => page.position)
    },
    needsRefresh:
      changed.some(email => !listed.has(email.id)) ||
      (isCollapsed && removed > 0)
  }
}
