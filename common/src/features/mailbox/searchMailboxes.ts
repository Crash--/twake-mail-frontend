import {
  buildMailboxSections,
  listVisibleMailboxes,
  mailboxPath,
  type VisibleMailbox
} from './mailboxTree'
import type { MailboxSummary } from './queries'

/** A folder found by the search of the sidebar */
export interface MailboxSearchResult {
  /** The row as the tree shows it, flat: no level, no children */
  row: VisibleMailbox
  /**
   * Where the folder is, as tmail-flutter's `mailboxPath` (`Work/Clients`)
   * for a subfolder, null for a top level folder
   */
  path: string | null
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
}

/**
 * Whether `name` holds every word of `query`, ignoring case and accents. An
 * empty query matches nothing.
 */
export function nameMatches(name: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const normalized = normalize(name)
  return words.length > 0 && words.every(word => normalized.includes(word))
}

/**
 * The folders whose displayed name holds every word of `query`, ignoring case
 * and accents: all of them, hidden ones included (they are the way back to
 * a hidden folder), the user's folders first and the team mailboxes after,
 * each in the order of the tree. An empty query finds nothing, as
 * tmail-flutter.
 */
export function searchMailboxes(
  mailboxes: readonly MailboxSummary[],
  query: string,
  getName: (mailbox: MailboxSummary) => string
): MailboxSearchResult[] {
  if (query.trim() === '') return []

  const { personal, team } = buildMailboxSections(mailboxes, true)
  const rows = [
    ...listVisibleMailboxes(personal, () => true),
    ...listVisibleMailboxes(team, () => true)
  ].filter(({ mailbox }) => nameMatches(getName(mailbox), query))

  return rows.map((row, index) => {
    const { mailbox } = row
    return {
      row: {
        mailbox,
        level: 1,
        hasChildren: false,
        isExpanded: false,
        position: index + 1,
        siblingCount: rows.length
      },
      // The root of a team mailbox shows its address on its own
      path:
        mailbox.parentId === null
          ? null
          : mailboxPath(mailboxes, mailbox.id, getName)
    }
  })
}
