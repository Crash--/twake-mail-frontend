import type { EmailChanges } from '@common/features/thread/patchEmailList'
import type {
  EmailListData,
  EmailListPage
} from '@common/features/thread/queries'

export interface SearchListPatch {
  data: EmailListData
  /**
   * Emails the results do not list changed (arrived, or were updated
   * elsewhere): only the server can tell whether they match now
   */
  hasUnlistedChanges: boolean
}

/**
 * Applies `changes` to loaded search results, without knowing the filter:
 *
 * - a destroyed email is removed;
 * - a listed email is replaced (keywords, mailboxes) and stays where it
 *   is, as in tmail-flutter: archiving or reading a result from the results
 *   shows its new state rather than making it vanish;
 * - an email the results do not list is reported, for the caller to query
 *   the loaded window again (James has no `Email/queryChanges`).
 *
 * Positions and counts follow, pages take the new state of their state.
 */
export function patchSearchList(
  data: EmailListData,
  { changed, destroyed, newStates }: EmailChanges
): SearchListPatch {
  const destroyedIds = new Set(destroyed)
  const changedById = new Map(changed.map(email => [email.id, email]))
  const listed = new Set<string>()
  let position = data.pages[0]?.position ?? 0
  let removed = 0

  const pages = data.pages.map((page): EmailListPage => {
    const emails = page.emails.flatMap(email => {
      if (destroyedIds.has(email.id) || listed.has(email.id)) return []
      listed.add(email.id)
      return [changedById.get(email.id) ?? email]
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
    hasUnlistedChanges: changed.some(email => !listed.has(email.id))
  }
}
