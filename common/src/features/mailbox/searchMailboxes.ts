import {
  buildMailboxSections,
  listVisibleMailboxes,
  mailboxPath,
  teamMailboxAddress,
  type VisibleMailbox
} from './mailboxTree'
import type { MailboxSummary } from './queries'

/** A folder found by the search of the sidebar */
export interface MailboxSearchResult {
  /** The row as the tree shows it, flat: no level, no children */
  row: VisibleMailbox
  /**
   * Where the folder is, as tmail-flutter's `mailboxPath` (`Work/Clients`)
   * for a subfolder, the address of the team mailbox for its root, else null
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
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const { personal, team } = buildMailboxSections(mailboxes, true)
  const rows = [
    ...listVisibleMailboxes(personal, () => true),
    ...listVisibleMailboxes(team, () => true)
  ].filter(({ mailbox }) => {
    const name = normalize(getName(mailbox))
    return words.every(word => name.includes(word))
  })

  return rows.map((row, index) => {
    const { mailbox } = row
    const address = teamMailboxAddress(mailbox)
    return {
      row: {
        mailbox,
        level: 1,
        hasChildren: false,
        isExpanded: false,
        position: index + 1,
        siblingCount: rows.length
      },
      path:
        mailbox.parentId === null
          ? address
          : mailboxPath(mailboxes, mailbox.id, getName)
    }
  })
}
