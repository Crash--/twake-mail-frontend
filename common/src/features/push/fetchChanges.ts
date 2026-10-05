import type { AnyCallHandle, ChangesResponse, JmapClient } from 'jmap-client-ts'

import {
  MAILBOX_PROPERTIES,
  type MailboxSummary
} from '@common/features/mailbox/queries'
import {
  EMAIL_LIST_PROPERTIES,
  type EmailListItemData
} from '@common/features/thread/queries'

/** `/changes` requests in a row before giving up on `hasMoreChanges` */
export const MAX_CHANGES_ROUNDS = 5

/** Changes of one data type since one state, accumulated over the rounds */
export interface TypeChanges<T extends { id: string }> {
  sinceState: string
  newState: string
  changed: T[]
  destroyed: string[]
}

/** `null` when the changes since that state could not be computed */
export type TypeChangesResult<T extends { id: string }> = TypeChanges<T> | null

export interface ChangesRequest {
  /** State of the cached mailboxes, null to skip them */
  mailboxSince: string | null
  /** States of the cached email lists (one `Email/changes` each) */
  emailSince: readonly string[]
}

export interface ChangesResult {
  mailbox: TypeChangesResult<MailboxSummary> | null
  /** Same order as `emailSince` */
  email: TypeChangesResult<EmailListItemData>[]
}

interface Branch<T extends { id: string }> {
  /** Where the next round starts from */
  cursor: string
  changes: TypeChanges<T>
  failed: boolean
  done: boolean
}

interface RoundHandles<T> {
  changes: PromiseLike<ChangesResponse>
  created: PromiseLike<{ list: T[]; notFound: string[] }>
  updated: PromiseLike<{ list: T[]; notFound: string[] }>
}

type Settled<T> = { ok: true; value: T } | { ok: false }

async function settle<T>(handle: PromiseLike<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await handle }
  } catch {
    return { ok: false }
  }
}

function makeBranch<T extends { id: string }>(sinceState: string): Branch<T> {
  return {
    cursor: sinceState,
    changes: { sinceState, newState: sinceState, changed: [], destroyed: [] },
    failed: false,
    done: false
  }
}

/** Merges one round in the branch: later rounds win, destruction wins */
async function readRound<T extends { id: string }>(
  branch: Branch<T>,
  handles: RoundHandles<T>
): Promise<void> {
  const [changes, created, updated] = await Promise.all([
    settle(handles.changes),
    settle(handles.created),
    settle(handles.updated)
  ])
  if (!changes.ok || !created.ok || !updated.ok) {
    branch.failed = true
    return
  }
  const destroyed = new Set([
    ...branch.changes.destroyed,
    ...changes.value.destroyed,
    ...created.value.notFound,
    ...updated.value.notFound
  ])
  const changedById = new Map(
    branch.changes.changed.map(item => [item.id, item])
  )
  for (const item of [...created.value.list, ...updated.value.list]) {
    changedById.set(item.id, item)
  }
  branch.changes = {
    sinceState: branch.changes.sinceState,
    newState: changes.value.newState,
    changed: [...changedById.values()].filter(item => !destroyed.has(item.id)),
    destroyed: [...destroyed]
  }
  branch.cursor = changes.value.newState
  branch.done = !changes.value.hasMoreChanges
}

function result<T extends { id: string }>(
  branch: Branch<T>
): TypeChangesResult<T> {
  return branch.failed || !branch.done ? null : branch.changes
}

/**
 * Fetches what changed since the cached states, in one JMAP request per
 * round: `Mailbox/changes` and `Email/changes`, each followed by the
 * `Mailbox/get` / `Email/get` of its created and updated ids through
 * back-references (the list properties for emails). Another round follows
 * while the server has more changes, up to `MAX_CHANGES_ROUNDS`.
 *
 * A type whose changes fail (`cannotCalculateChanges`, an unknown state, too
 * many changes) comes back `null`: its cache has to be refetched.
 */
export async function fetchChanges(
  client: JmapClient,
  accountId: string,
  { mailboxSince, emailSince }: ChangesRequest
): Promise<ChangesResult> {
  const mailbox =
    mailboxSince === null ? null : makeBranch<MailboxSummary>(mailboxSince)
  const emails = emailSince.map(state => makeBranch<EmailListItemData>(state))
  const isPending = (branch: Branch<{ id: string }> | null): boolean =>
    branch !== null && !branch.done && !branch.failed

  for (let round = 0; round < MAX_CHANGES_ROUNDS; round++) {
    const pendingEmails = emails.filter(isPending)
    const pendingMailbox =
      mailbox !== null && isPending(mailbox) ? mailbox : null
    if (pendingMailbox === null && pendingEmails.length === 0) break

    const reads: Promise<void>[] = []
    await client.requestSettled(builder => {
      const handles: AnyCallHandle[] = []
      if (pendingMailbox) {
        const changes = builder.call('Mailbox/changes', {
          accountId,
          sinceState: pendingMailbox.cursor
        })
        const created = builder.call('Mailbox/get', {
          accountId,
          '#ids': changes.ref('/created'),
          properties: [...MAILBOX_PROPERTIES]
        })
        const updated = builder.call('Mailbox/get', {
          accountId,
          '#ids': changes.ref('/updated'),
          properties: [...MAILBOX_PROPERTIES]
        })
        handles.push(changes, created, updated)
        reads.push(readRound(pendingMailbox, { changes, created, updated }))
      }
      for (const branch of pendingEmails) {
        const changes = builder.call('Email/changes', {
          accountId,
          sinceState: branch.cursor
        })
        const created = builder.call('Email/get', {
          accountId,
          '#ids': changes.ref('/created'),
          properties: [...EMAIL_LIST_PROPERTIES]
        })
        const updated = builder.call('Email/get', {
          accountId,
          '#ids': changes.ref('/updated'),
          properties: [...EMAIL_LIST_PROPERTIES]
        })
        handles.push(changes, created, updated)
        reads.push(readRound(branch, { changes, created, updated }))
      }
      return handles
    })
    await Promise.all(reads)
  }

  return {
    mailbox: mailbox === null ? null : result(mailbox),
    email: emails.map(result)
  }
}

/** The current `Email` and `Mailbox` states of the account */
export interface CurrentStates {
  Email: string
  Mailbox: string
}

/**
 * The current `Email` and `Mailbox` states of the account, in one small
 * request (`/get` of no id): what a push would say, to tell whether the
 * cache is behind
 */
export async function fetchCurrentStates(
  client: JmapClient,
  accountId: string
): Promise<CurrentStates> {
  const [emails, mailboxes] = await client.request(builder => [
    builder.call('Email/get', { accountId, ids: [], properties: ['id'] }),
    builder.call('Mailbox/get', { accountId, ids: [], properties: ['id'] })
  ])
  return { Email: emails.state, Mailbox: mailboxes.state }
}
