import type { EmailListData, EmailListItemData, EmailListPage } from './queries'

/** What changed among the emails between two `Email` states */
export interface EmailChanges {
  /** Created and updated emails, with the list properties */
  changed: readonly EmailListItemData[]
  /** Destroyed emails, and changed ones the server no longer finds */
  destroyed: readonly string[]
  /**
   * The state each synchronized state moved to: pages at another state
   * keep theirs, so that a later synchronization catches them up
   */
  newStates: ReadonlyMap<string, string>
}

interface PageDraft {
  page: EmailListPage
  emails: EmailListItemData[]
  /** Rows added (positive) or removed (negative) */
  delta: number
}

/** Index of the first email received before `email`, or -1 */
function insertionIndex(
  emails: readonly EmailListItemData[],
  email: EmailListItemData
): number {
  return emails.findIndex(candidate => candidate.receivedAt < email.receivedAt)
}

/** The last row of the loaded window, null when nothing is loaded */
function lastLoadedRow(drafts: readonly PageDraft[]): EmailListItemData | null {
  for (let index = drafts.length - 1; index >= 0; index -= 1) {
    const emails = drafts[index]?.emails ?? []
    const last = emails[emails.length - 1]
    if (last !== undefined) return last
  }
  return null
}

/**
 * Inserts `email` where the server sorts it (`receivedAt` descending), if it
 * falls within the loaded window: before the first email received earlier;
 * at the end when the list is complete, or when it was received at the same
 * time as the last row: the server may sort it before that row, so that the
 * rows loaded cover it whatever the order it gives equal dates, and the next
 * page starts after it. Older, it comes with the next page, at its place:
 * the positions before it did not move. Returns false when it is not
 * inserted.
 */
function insertEmail(drafts: PageDraft[], email: EmailListItemData): boolean {
  for (const draft of drafts) {
    const index = insertionIndex(draft.emails, email)
    if (index !== -1) {
      draft.emails.splice(index, 0, email)
      draft.delta += 1
      return true
    }
  }
  const last = drafts[drafts.length - 1]
  const lastRow = lastLoadedRow(drafts)
  const isAtTheEnd =
    last?.page.isLast === true ||
    (lastRow !== null && email.receivedAt >= lastRow.receivedAt)
  if (last === undefined || !isAtTheEnd) return false
  last.emails.push(email)
  last.delta += 1
  return true
}

/**
 * Applies `changes` to the loaded pages of the list of `mailboxId`, as if
 * they had been fetched again:
 *
 * - a destroyed email, or one that left the mailbox, is removed;
 * - an updated email still in the mailbox is replaced (keywords, mailboxes);
 * - an email that entered the mailbox (created or moved) is inserted where
 *   `receivedAt` sorts it, when that place is within the loaded pages.
 *
 * Positions and counts follow, so that the next page starts at the right
 * position; pages take the new state of the state they were at.
 */
export function patchEmailList(
  data: EmailListData,
  mailboxId: string,
  { changed, destroyed, newStates }: EmailChanges
): EmailListData {
  const destroyedIds = new Set(destroyed)
  const changedById = new Map(changed.map(email => [email.id, email]))
  const listed = new Set<string>()

  const drafts: PageDraft[] = data.pages.map(page => {
    const emails: EmailListItemData[] = []
    for (const email of page.emails) {
      if (destroyedIds.has(email.id) || listed.has(email.id)) continue
      const update = changedById.get(email.id)
      if (update && !(mailboxId in update.mailboxIds)) continue
      emails.push(update ?? email)
      listed.add(email.id)
    }
    return { page, emails, delta: emails.length - page.emails.length }
  })

  const entering = changed
    .filter(email => mailboxId in email.mailboxIds && !listed.has(email.id))
    .filter(email => !destroyedIds.has(email.id))
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
  for (const email of entering) {
    if (insertEmail(drafts, email)) listed.add(email.id)
  }

  const totalDelta = drafts.reduce((sum, draft) => sum + draft.delta, 0)
  let position = data.pages[0]?.position ?? 0
  const pages = drafts.map(({ page, emails, delta }): EmailListPage => {
    const patched: EmailListPage = {
      ...page,
      emails,
      position,
      count: Math.max(0, page.count + delta),
      total: page.total === null ? null : Math.max(0, page.total + totalDelta),
      state: newStates.get(page.state) ?? page.state
    }
    position += patched.count
    return patched
  })
  return { pages, pageParams: pages.map(page => page.position) }
}

/**
 * Keeps the first page only, to refetch it when the changes cannot be
 * computed: the pages below would be refetched one after the other.
 */
export function keepFirstPage(data: EmailListData): EmailListData {
  return {
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1)
  }
}
