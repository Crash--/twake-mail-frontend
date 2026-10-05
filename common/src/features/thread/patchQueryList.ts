import type { EmailFilterCondition, Filter } from 'jmap-client-ts'

import { filterVerdict } from './filterVerdict'
import type { ThreadEmailUpdate } from './patchThreadList'
import {
  byReceivedAt,
  type EmailListData,
  type EmailListItemData,
  type EmailListPage,
  type ThreadMember
} from './queries'

/** Changes of the emails (`EmailChanges`), possibly partial (optimistic) */
export interface QueryListChanges {
  changed: readonly ThreadEmailUpdate[]
  destroyed: readonly string[]
  newStates: ReadonlyMap<string, string>
}

export interface QueryListPatch {
  data: EmailListData
  /**
   * Only the server can tell what the list holds now: emails it does not
   * know changed (arrived, or were updated elsewhere), or the email
   * standing for a conversation left
   */
  needsRefresh: boolean
}

export interface QueryListScope {
  /** The mailbox the list shows: emails leaving it leave the list */
  mailboxId?: string
  /** One row per conversation (`collapseThreads`) */
  isCollapsed?: boolean
  /**
   * The filter of the list: an email it does not know that cannot match it
   * (in the Trash for a search leaving it out, unread for starred
   * results…) changes nothing
   */
  filter?: Filter<EmailFilterCondition>
  /**
   * The list is narrowed by a filter of the toolbar: a listed email that no
   * longer matches `filter` leaves it (search results keep it in place)
   */
  dropsNonMatching?: boolean
}

function patchMember(
  member: ThreadMember,
  update: ThreadEmailUpdate
): ThreadMember {
  return {
    ...member,
    mailboxIds: update.mailboxIds,
    keywords: update.keywords
  }
}

/** A new email of a conversation listed, when its properties are known */
function newMember(
  update: ThreadEmailUpdate,
  threadId: string
): ThreadMember | null {
  const { receivedAt } = update
  if (receivedAt === undefined) return null
  return {
    id: update.id,
    threadId,
    mailboxIds: update.mailboxIds,
    keywords: update.keywords,
    receivedAt,
    from: update.from ?? null,
    to: update.to ?? null,
    hasAttachment: update.hasAttachment ?? false
  }
}

/**
 * Whether a row of a filtered list stays: its email matches the filter, or
 * on a list of conversations one email of its thread does (`maybe` stays:
 * only the server knows)
 */
function stillMatches(
  email: EmailListItemData,
  members: readonly ThreadMember[] | undefined,
  changedById: ReadonlyMap<string, ThreadEmailUpdate>,
  filter: Filter<EmailFilterCondition> | undefined
): boolean {
  const candidates = members ?? [email]
  return candidates.some(member => {
    const update = changedById.get(member.id)
    return (
      filterVerdict(filter, update ? { ...member, ...update } : member) !== 'no'
    )
  })
}

/**
 * Applies `changes` to a list the client cannot sort or filter by itself
 * (search results):
 *
 * - a destroyed email is removed, as one that left the mailbox listed;
 * - on a list narrowed by a filter of the toolbar (`dropsNonMatching`), an
 *   email that no longer matches it leaves the list, as in tmail-flutter's
 *   client-side `filterEmail`;
 * - a listed email takes its new state (keywords, mailboxes) and stays
 *   where it is: archiving or reading a search result shows its new state
 *   rather than making it vanish, as in tmail-flutter;
 * - results grouped by conversation keep the emails of each thread listed
 *   up to date, a new reply included: the conversation stays where it is,
 *   in its new state;
 * - when an email the list does not know changed and may match its filter
 *   (`filterVerdict`), or a conversation lost the email standing for it,
 *   the caller queries the loaded window again (James has no
 *   `Email/queryChanges`).
 *
 * Positions and counts follow, pages take the new state of their state.
 */
export function patchQueryList(
  data: EmailListData,
  { changed, destroyed, newStates }: QueryListChanges,
  {
    mailboxId,
    isCollapsed = false,
    filter,
    dropsNonMatching = false
  }: QueryListScope = {}
): QueryListPatch {
  const destroyedIds = new Set(destroyed)
  const changedById = new Map(changed.map(email => [email.id, email]))
  const listed = new Set<string>()
  // The conversations listed, and the emails they hold
  const listedThreads = new Set<string>()
  const members = new Set<string>()
  for (const page of data.pages) {
    for (const [threadId, list] of Object.entries(page.threads ?? {})) {
      listedThreads.add(threadId)
      list.forEach(member => members.add(member.id))
    }
  }
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
      const patched = update ? { ...email, ...update } : email
      if (
        dropsNonMatching &&
        !stillMatches(
          patched,
          page.threads?.[email.threadId],
          changedById,
          filter
        )
      ) {
        return []
      }
      return [patched]
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
    if (page.threads !== undefined) {
      patched.threads = Object.fromEntries(
        emails.map(email => {
          const list = (page.threads?.[email.threadId] ?? [email]).flatMap(
            member => {
              if (destroyedIds.has(member.id)) return []
              const update = changedById.get(member.id)
              return [update ? patchMember(member, update) : member]
            }
          )
          // New replies of the conversation
          for (const update of changed) {
            if (update.threadId !== email.threadId || members.has(update.id)) {
              continue
            }
            const member = newMember(update, email.threadId)
            if (member !== null) list.push(member)
          }
          return [email.threadId, list.sort(byReceivedAt)]
        })
      )
    }
    position += patched.count
    return patched
  })

  const isKnown = (email: ThreadEmailUpdate): boolean =>
    listed.has(email.id) ||
    members.has(email.id) ||
    (isCollapsed &&
      email.threadId !== undefined &&
      listedThreads.has(email.threadId))
  return {
    data: {
      pages: pages.map(page => ({
        ...page,
        total: page.total === null ? null : Math.max(0, page.total - removed)
      })),
      pageParams: pages.map(page => page.position)
    },
    needsRefresh:
      changed.some(
        email => !isKnown(email) && filterVerdict(filter, email) !== 'no'
      ) ||
      (isCollapsed && removed > 0)
  }
}
