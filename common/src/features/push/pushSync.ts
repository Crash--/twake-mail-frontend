import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'

import { patchEmailDetail } from '@common/features/email/patchEmailDetail'
import { emailKeys, type EmailDetail } from '@common/features/email/queries'
import { patchMailboxes } from '@common/features/mailbox/patchMailboxes'
import {
  mailboxKeys,
  normalizeMailbox,
  type MailboxListData
} from '@common/features/mailbox/queries'
import {
  keepFirstPage,
  patchEmailList,
  type EmailChanges
} from '@common/features/thread/patchEmailList'
import { fetchThreadUpdates } from '@common/features/thread/fetchThreadUpdates'
import { patchConversation } from '@common/features/thread/patchConversation'
import {
  patchQueryList,
  type QueryListScope
} from '@common/features/thread/patchQueryList'
import {
  patchThreadList,
  type ThreadListChanges
} from '@common/features/thread/patchThreadList'
import {
  conversationKeys,
  isSearchRequest,
  threadKeys,
  type ConversationData,
  type EmailListData,
  type EmailListItemData,
  type SearchRequest
} from '@common/features/thread/queries'
import { refreshQueryList } from '@common/features/thread/refreshQueryList'

import { fetchChanges, type TypeChanges } from './fetchChanges'

/** The JMAP data types the app follows over push */
export type SyncedType = 'Email' | 'Mailbox'

export const SYNCED_TYPES: readonly SyncedType[] = ['Email', 'Mailbox']

/**
 * Distinct `Email` states the cached lists may be at before the changes are
 * given up for a refetch (one `Email/changes` each). A round holds 3 calls
 * per state plus 3 for the mailboxes: 15, within the 16 `maxCallsInRequest`
 * of James.
 */
const MAX_EMAIL_STATES = 4

/** Synchronizations a list or the mailboxes can trigger between two pushes */
const MAX_FOLLOW_UPS = 3

export interface PushSync {
  /** The server pushed new states (`StateChange` of the account) */
  stateChanged: (states: Readonly<Record<string, string>>) => void
  /** Catches up after the push channel was down */
  catchUp: () => void
  /** Resolves once no synchronization runs nor waits */
  whenIdle: () => Promise<void>
  close: () => void
}

function logError(error: unknown): void {
  console.error('[push] Cannot refresh the data', error)
}

/** An email list of the cache, and how push brings it up to date */
type CachedList =
  /** The emails of a mailbox, sorted by date: patched in place */
  | { kind: 'mailbox'; mailboxId: string }
  /**
   * The conversations of a mailbox, sorted by date: patched in place from
   * the members of the threads listed
   */
  | { kind: 'threads'; mailboxId: string }
  /** Search results: patched, then queried */
  | { kind: 'query'; request: SearchRequest; scope: QueryListScope }
  /** The emails of a conversation */
  | { kind: 'conversation'; threadId: string }

function describeList(key: QueryKey, accountId: string): CachedList | null {
  const [feature, account, kind, value] = key
  if (
    feature === 'conversation' &&
    account === accountId &&
    typeof kind === 'string'
  ) {
    return { kind: 'conversation', threadId: kind }
  }
  if (feature !== 'thread' || account !== accountId) return null
  if (kind === 'list' && typeof value === 'string') {
    return { kind: 'mailbox', mailboxId: value }
  }
  if (kind === 'threads' && typeof value === 'string') {
    return { kind: 'threads', mailboxId: value }
  }
  if (kind === 'search' && isSearchRequest(value)) {
    return {
      kind: 'query',
      request: value,
      scope: { isCollapsed: value.collapseThreads === true }
    }
  }
  return null
}

function isQueryKey(value: unknown): value is QueryKey {
  return Array.isArray(value)
}

function isMailboxList(key: QueryKey, accountId: string): boolean {
  const [feature, account, kind] = key
  return feature === 'mailbox' && account === accountId && kind === 'list'
}

function mergeEmailChanges(
  branches: readonly TypeChanges<EmailListItemData>[]
): EmailChanges {
  const destroyed = new Set(branches.flatMap(branch => branch.destroyed))
  const changed = new Map<string, EmailListItemData>()
  for (const branch of branches) {
    for (const email of branch.changed) changed.set(email.id, email)
  }
  return {
    changed: [...changed.values()].filter(email => !destroyed.has(email.id)),
    destroyed: [...destroyed],
    newStates: new Map(
      branches.map(branch => [branch.sinceState, branch.newState])
    )
  }
}

/**
 * Keeps the cached mailboxes, email lists and opened emails up to date with
 * the server, from the states they hold, instead of refetching them:
 *
 * - a push (`StateChange`) newer than the cache starts a synchronization:
 *   `Mailbox/changes` and `Email/changes` with the `/get` of what changed,
 *   in one request (`fetchChanges`), then a patch of every loaded page;
 * - synchronizations never overlap: one asked while another runs waits;
 * - a list or the mailboxes landing in the cache at another state than the
 *   last one known (a page fetched while a patch was applied, or before a
 *   change was pushed) start another one;
 * - when the changes cannot be computed, the email lists at the states that
 *   failed are cut to their first page and refetched, the mailboxes
 *   refetched.
 */
export function createPushSync(
  queryClient: QueryClient,
  client: JmapClient,
  accountId: string
): PushSync {
  const cache = queryClient.getQueryCache()
  /** The newest states the server told about */
  const latest: Record<SyncedType, string | null> = {
    Email: null,
    Mailbox: null
  }
  const requested = new Set<SyncedType>()
  let running: Promise<void> | null = null
  let followUps = 0
  let isClosed = false

  function emailListKeys(): QueryKey[] {
    return [
      ...cache.findAll({ queryKey: threadKeys.all(accountId) }),
      ...cache.findAll({ queryKey: conversationKeys.all(accountId) })
    ]
      .map(query => query.queryKey)
      .filter(key => describeList(key, accountId) !== null)
  }

  /** The `Email` states a cached list is at: one per page */
  function statesOf(key: QueryKey): string[] {
    const list = describeList(key, accountId)
    if (list?.kind === 'conversation') {
      const data = queryClient.getQueryData<ConversationData>(key)
      return data === undefined ? [] : [data.state]
    }
    const data = queryClient.getQueryData<EmailListData>(key)
    return data?.pages.map(page => page.state) ?? []
  }

  function emailListStates(): Set<string> {
    return new Set(emailListKeys().flatMap(statesOf))
  }

  function hasEmailDetails(): boolean {
    return (
      queryClient.getQueriesData<EmailDetail | null>({
        queryKey: emailKeys.all(accountId)
      }).length > 0
    )
  }

  function isUpToDate(type: SyncedType, state: string): boolean {
    if (type === 'Mailbox') {
      const data = queryClient.getQueryData<MailboxListData>(
        mailboxKeys.list(accountId)
      )
      return data === undefined || data.state === state
    }
    const states = emailListStates()
    if (states.size === 0) return !hasEmailDetails()
    return [...states].every(candidate => candidate === state)
  }

  function refetchMailboxes(): void {
    queryClient
      .invalidateQueries({ queryKey: mailboxKeys.all(accountId) })
      .catch(logError)
  }

  function refetchEmailDetails(): void {
    queryClient
      .invalidateQueries({ queryKey: emailKeys.all(accountId) })
      .catch(logError)
  }

  /**
   * The changes cannot be computed from the states of these lists: their
   * first page again, and the opened emails
   */
  function refetchEmailLists(keys: readonly QueryKey[]): void {
    for (const key of keys) {
      if (describeList(key, accountId)?.kind !== 'conversation') {
        queryClient.setQueryData<EmailListData>(key, data =>
          data ? keepFirstPage(data) : data
        )
      }
      queryClient
        .invalidateQueries({ queryKey: key, exact: true })
        .catch(logError)
    }
    refetchEmailDetails()
  }

  /**
   * A list the client cannot sort nor filter (search results, conversations
   * of a mailbox) is queried again: shown lists at once, the others start
   * over when shown again
   */
  async function refreshList(
    key: QueryKey,
    request: SearchRequest
  ): Promise<void> {
    const data = queryClient.getQueryData<EmailListData>(key)
    if (data === undefined) return
    const query = cache.find({ queryKey: key, exact: true })
    if (query === undefined || query.getObserversCount() === 0) {
      queryClient.setQueryData<EmailListData>(key, keepFirstPage(data))
      await queryClient.invalidateQueries({
        queryKey: key,
        exact: true,
        refetchType: 'none'
      })
      return
    }
    const refreshed = await refreshQueryList(client, accountId, request, data)
    if (isClosed) return
    if (refreshed === null) {
      refetchEmailLists([key])
    } else {
      queryClient.setQueryData<EmailListData>(key, refreshed)
    }
  }

  /**
   * Patches the lists of conversations. Changes they cannot place alone (a
   * conversation coming in, another email standing for one) bring the
   * members of those threads and the rows of those emails, in one more
   * request for all the lists, then a second patch.
   */
  async function patchThreadLists(
    lists: readonly { key: QueryKey; mailboxId: string }[],
    changes: EmailChanges
  ): Promise<void> {
    const threadIds = new Set<string>()
    const rowIds = new Set<string>()
    for (const { key, mailboxId } of lists) {
      const data = queryClient.getQueryData<EmailListData>(key)
      if (data === undefined) continue
      const patch = patchThreadList(data, mailboxId, changes)
      queryClient.setQueryData<EmailListData>(key, patch.data)
      patch.unknownThreadIds.forEach(id => threadIds.add(id))
      patch.missingRowIds.forEach(id => rowIds.add(id))
    }
    if (threadIds.size === 0 && rowIds.size === 0) return
    const updates = await fetchThreadUpdates(client, accountId, {
      threadIds: [...threadIds],
      rowIds: [...rowIds]
    })
    if (isClosed) return
    const complete: ThreadListChanges = { ...changes, ...updates }
    for (const { key, mailboxId } of lists) {
      queryClient.setQueryData<EmailListData>(key, data =>
        data ? patchThreadList(data, mailboxId, complete).data : data
      )
    }
  }

  /**
   * Patches the lists, except those holding a page at a state whose changes
   * failed: those are refetched, the others keep their loaded pages
   */
  async function applyEmailChanges(
    changes: EmailChanges,
    failedStates: ReadonlySet<string>
  ): Promise<void> {
    const failedLists: QueryKey[] = []
    const refreshes: Promise<void>[] = []
    const threadLists: { key: QueryKey; mailboxId: string }[] = []
    for (const key of emailListKeys()) {
      const list = describeList(key, accountId)
      if (list === null) continue
      if (statesOf(key).some(state => failedStates.has(state))) {
        failedLists.push(key)
        continue
      }
      if (list.kind === 'conversation') {
        queryClient.setQueryData<ConversationData>(key, current =>
          current ? patchConversation(current, list.threadId, changes) : current
        )
        continue
      }
      const data = queryClient.getQueryData<EmailListData>(key)
      if (data === undefined) continue
      if (list.kind === 'mailbox') {
        queryClient.setQueryData<EmailListData>(
          key,
          patchEmailList(data, list.mailboxId, changes)
        )
        continue
      }
      if (list.kind === 'threads') {
        threadLists.push({ key, mailboxId: list.mailboxId })
        continue
      }
      const patch = patchQueryList(data, changes, list.scope)
      queryClient.setQueryData<EmailListData>(key, patch.data)
      if (patch.needsRefresh) {
        refreshes.push(
          refreshList(key, list.request).catch((error: unknown) => {
            logError(error)
            refetchEmailLists([key])
          })
        )
      }
    }
    for (const [key] of queryClient.getQueriesData<EmailDetail | null>({
      queryKey: emailKeys.all(accountId)
    })) {
      queryClient.setQueryData<EmailDetail | null>(key, detail =>
        detail === undefined ? detail : patchEmailDetail(detail, changes)
      )
    }
    if (threadLists.length > 0) {
      refreshes.push(
        patchThreadLists(threadLists, changes).catch((error: unknown) => {
          logError(error)
          refetchEmailLists(threadLists.map(({ key }) => key))
        })
      )
    }
    if (failedLists.length > 0) refetchEmailLists(failedLists)
    await Promise.all(refreshes)
  }

  async function synchronize(types: ReadonlySet<SyncedType>): Promise<void> {
    const mailboxes = types.has('Mailbox')
      ? queryClient.getQueryData<MailboxListData>(mailboxKeys.list(accountId))
      : undefined
    let emailStates = types.has('Email') ? [...emailListStates()] : []
    if (types.has('Email') && emailStates.length === 0) refetchEmailDetails()
    if (emailStates.length > MAX_EMAIL_STATES) {
      refetchEmailLists(emailListKeys())
      emailStates = []
    }
    if (mailboxes === undefined && emailStates.length === 0) return

    const result = await fetchChanges(client, accountId, {
      mailboxSince: mailboxes?.state ?? null,
      emailSince: emailStates
    })
    if (isClosed) return

    if (mailboxes !== undefined) {
      const changes = result.mailbox
      if (changes) {
        latest.Mailbox = changes.newState
        queryClient.setQueryData<MailboxListData>(
          mailboxKeys.list(accountId),
          data =>
            data
              ? patchMailboxes(data, {
                  changed: changes.changed.map(normalizeMailbox),
                  destroyed: changes.destroyed,
                  oldState: changes.sinceState,
                  newState: changes.newState
                })
              : data
        )
      } else {
        refetchMailboxes()
      }
    }

    if (emailStates.length > 0) {
      const branches = result.email.filter(branch => branch !== null)
      const failedStates = new Set(
        emailStates.filter((_state, index) => result.email[index] === null)
      )
      const last = branches[branches.length - 1]
      if (last === undefined) {
        refetchEmailLists(emailListKeys())
      } else {
        latest.Email = last.newState
        await applyEmailChanges(mergeEmailChanges(branches), failedStates)
      }
    }
  }

  async function drain(): Promise<void> {
    // Lets the triggers of the same tick join the same synchronization
    await Promise.resolve()
    while (requested.size > 0 && !isClosed) {
      const types = new Set(requested)
      requested.clear()
      try {
        await synchronize(types)
      } catch (error: unknown) {
        logError(error)
      }
    }
  }

  function schedule(): void {
    if (running !== null || isClosed) return
    running = drain().finally(() => {
      running = null
      if (requested.size > 0) schedule()
    })
  }

  function request(types: Iterable<SyncedType>): void {
    for (const type of types) requested.add(type)
    if (requested.size > 0) schedule()
  }

  function followUp(type: SyncedType): void {
    if (followUps >= MAX_FOLLOW_UPS) return
    followUps += 1
    request([type])
  }

  const unsubscribe = cache.subscribe(event => {
    // Fetches only: `setQueryData` (patches, optimistic updates) is manual
    if (event.type !== 'updated' || event.action.type !== 'success') return
    if (event.action.manual === true) return
    const key: unknown = event.query.queryKey
    if (!isQueryKey(key)) return
    if (describeList(key, accountId) !== null && latest.Email !== null) {
      if (statesOf(key).some(state => state !== latest.Email)) {
        followUp('Email')
      }
    } else if (isMailboxList(key, accountId) && latest.Mailbox !== null) {
      const data = queryClient.getQueryData<MailboxListData>(key)
      if (data && data.state !== latest.Mailbox) followUp('Mailbox')
    }
  })

  return {
    stateChanged: states => {
      followUps = 0
      const stale: SyncedType[] = []
      for (const type of SYNCED_TYPES) {
        const state = states[type]
        if (state === undefined) continue
        latest[type] = state
        if (!isUpToDate(type, state)) stale.push(type)
      }
      request(stale)
    },
    catchUp: () => {
      request(SYNCED_TYPES)
    },
    whenIdle: async () => {
      while (running !== null) await running
    },
    close: () => {
      isClosed = true
      unsubscribe()
    }
  }
}
