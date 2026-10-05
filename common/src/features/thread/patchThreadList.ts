import { patchEmailList } from './patchEmailList'
import {
  byReceivedAt,
  EMAIL_ROW_PROPERTIES,
  type EmailListData,
  type EmailListItemData,
  type EmailListPage,
  type ThreadMember
} from './queries'

/**
 * A change of an email as a list of conversations sees it: where it is and
 * its keywords, and its other list properties when they are known (push
 * brings them all, an optimistic update only the first ones)
 */
export type ThreadEmailUpdate = Pick<
  EmailListItemData,
  'id' | 'mailboxIds' | 'keywords'
> &
  Partial<EmailListItemData>

export interface ThreadListChanges {
  changed: readonly ThreadEmailUpdate[]
  /** Destroyed emails */
  destroyed: readonly string[]
  /** The state each synchronized state moved to (see `EmailChanges`) */
  newStates: ReadonlyMap<string, string>
  /**
   * The members of threads read again from the server, by thread id: they
   * replace what the list knew of them
   */
  threads?: ReadonlyMap<string, readonly ThreadMember[]>
  /** The rows (list properties) of emails coming to stand for a thread */
  rows?: ReadonlyMap<string, EmailListItemData>
}

export interface ThreadListPatch {
  data: EmailListData
  /**
   * Threads the list does not show that an email entering the mailbox may
   * bring within the loaded rows: their members are needed to place them
   */
  unknownThreadIds: string[]
  /**
   * Emails now standing for a listed conversation (its most recent email
   * in the mailbox) whose list properties the list lacks: the row keeps
   * the email it had until they come
   */
  missingRowIds: string[]
}

function isRow(email: ThreadEmailUpdate): email is EmailListItemData {
  return EMAIL_ROW_PROPERTIES.every(property => email[property] !== undefined)
}

function toMember(
  email: ThreadEmailUpdate,
  threadId: string,
  previous: ThreadMember | undefined
): ThreadMember | null {
  const receivedAt = email.receivedAt ?? previous?.receivedAt
  if (receivedAt === undefined) return null
  return {
    id: email.id,
    threadId,
    mailboxIds: email.mailboxIds,
    keywords: email.keywords,
    receivedAt,
    from: email.from ?? previous?.from ?? null,
    to: email.to ?? previous?.to ?? null,
    hasAttachment: email.hasAttachment ?? previous?.hasAttachment ?? false
  }
}

/**
 * The email standing for a conversation in a mailbox: its most recent email
 * there, as `Email/query` with `collapseThreads` picks it
 */
export function threadRowMember(
  members: Iterable<ThreadMember>,
  mailboxId: string
): ThreadMember | null {
  let latest: ThreadMember | null = null
  for (const member of members) {
    if (!(mailboxId in member.mailboxIds)) continue
    if (latest === null || byReceivedAt(latest, member) <= 0) latest = member
  }
  return latest
}

/** Whether an email received at `receivedAt` sorts within the loaded rows */
function isWithinLoaded(data: EmailListData, receivedAt: string): boolean {
  const lastPage = data.pages[data.pages.length - 1]
  if (lastPage === undefined || lastPage.isLast) return true
  const lastRow = data.pages
    .flatMap(page => page.emails)
    .reduce<EmailListItemData | null>(
      (oldest, email) =>
        oldest === null || email.receivedAt < oldest.receivedAt
          ? email
          : oldest,
      null
    )
  return lastRow === null || receivedAt >= lastRow.receivedAt
}

/**
 * Applies `changes` to the loaded pages of the conversations of `mailboxId`
 * (one row per thread, its most recent email in the mailbox, the most
 * recent first), from the members each page keeps, without querying the
 * list again:
 *
 * - the members follow (keywords, mailboxes; new replies join their
 *   thread, destroyed emails leave it);
 * - a conversation whose most recent email in the mailbox is another one
 *   now (a reply arrived, the last one left) moves to the place of that
 *   email, at the top for a new reply; one with no email left in the
 *   mailbox goes;
 * - a conversation the list does not show comes in where its email sorts,
 *   once its members are known (`unknownThreadIds`).
 *
 * Positions, counts and states follow, as `patchEmailList` does.
 */
export function patchThreadList(
  data: EmailListData,
  mailboxId: string,
  changes: ThreadListChanges
): ThreadListPatch {
  const members = new Map<string, Map<string, ThreadMember>>()
  const threadOf = new Map<string, string>()
  const rowOf = new Map<string, EmailListItemData>()
  const setMembers = (
    threadId: string,
    list: readonly ThreadMember[]
  ): void => {
    members.set(threadId, new Map(list.map(member => [member.id, member])))
    for (const member of list) threadOf.set(member.id, threadId)
  }
  for (const page of data.pages) {
    for (const email of page.emails) {
      rowOf.set(email.threadId, email)
      setMembers(email.threadId, page.threads?.[email.threadId] ?? [email])
    }
  }

  const affected = new Set<string>()
  const unknown = new Set<string>()
  for (const [threadId, list] of changes.threads ?? []) {
    setMembers(threadId, list)
    affected.add(threadId)
  }
  for (const id of changes.destroyed) {
    const threadId = threadOf.get(id)
    if (threadId === undefined) continue
    members.get(threadId)?.delete(id)
    affected.add(threadId)
  }
  const rows = new Map(changes.rows ?? [])
  for (const email of changes.changed) {
    if (isRow(email)) rows.set(email.id, email)
    const threadId = email.threadId ?? threadOf.get(email.id)
    // Not of a conversation the list knows, nor coming into the mailbox
    if (threadId === undefined || changes.threads?.has(threadId) === true) {
      continue
    }
    const thread = members.get(threadId)
    if (thread === undefined) {
      if (
        mailboxId in email.mailboxIds &&
        email.receivedAt !== undefined &&
        isWithinLoaded(data, email.receivedAt)
      ) {
        unknown.add(threadId)
      }
      continue
    }
    const member = toMember(email, threadId, thread.get(email.id))
    if (member === null) continue
    thread.set(email.id, member)
    threadOf.set(email.id, threadId)
    affected.add(threadId)
  }

  const updated: EmailListItemData[] = []
  const entering: EmailListItemData[] = []
  const leaving: string[] = []
  const missing: string[] = []
  for (const threadId of affected) {
    const row = rowOf.get(threadId)
    const standing = threadRowMember(
      members.get(threadId)?.values() ?? [],
      mailboxId
    )
    if (standing === null) {
      if (row) leaving.push(row.id)
      continue
    }
    const state = {
      mailboxIds: standing.mailboxIds,
      keywords: standing.keywords
    }
    if (row?.id === standing.id) {
      updated.push({ ...row, ...rows.get(row.id), ...state })
      continue
    }
    const full = rows.get(standing.id)
    if (full === undefined) {
      // Comes with the next synchronization; a thread not listed comes
      // with its page
      if (row) missing.push(standing.id)
      continue
    }
    if (row) leaving.push(row.id)
    entering.push({ ...full, ...state })
  }

  const patched = patchEmailList(data, mailboxId, {
    changed: [...updated, ...entering],
    destroyed: leaving,
    newStates: changes.newStates
  })
  const pages = patched.pages.map((page): EmailListPage => ({
    ...page,
    threads: Object.fromEntries(
      page.emails.map(email => [
        email.threadId,
        [...(members.get(email.threadId)?.values() ?? [])].sort(byReceivedAt)
      ])
    )
  }))
  return {
    data: { pages, pageParams: patched.pageParams },
    unknownThreadIds: [...unknown],
    missingRowIds: missing
  }
}
