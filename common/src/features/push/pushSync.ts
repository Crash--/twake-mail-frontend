import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'

import { patchEmailDetail } from '@common/features/email/patchEmailDetail'
import { emailKeys, type EmailDetail } from '@common/features/email/queries'
import { patchMailboxes } from '@common/features/mailbox/patchMailboxes'
import {
  mailboxKeys,
  type MailboxListData
} from '@common/features/mailbox/queries'
import {
  keepFirstPage,
  patchEmailList,
  type EmailChanges
} from '@common/features/thread/patchEmailList'
import {
  threadKeys,
  type EmailListData,
  type EmailListItemData
} from '@common/features/thread/queries'

import { fetchChanges, type TypeChanges } from './fetchChanges'

/** The JMAP data types the app follows over push */
export type SyncedType = 'Email' | 'Mailbox'

export const SYNCED_TYPES: readonly SyncedType[] = ['Email', 'Mailbox']

/**
 * Distinct `Email` states the cached lists may be at before the changes are
 * given up for a refetch (one `Email/changes` each)
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

function mailboxIdOfList(key: QueryKey, accountId: string): string | null {
  const [feature, account, kind, mailboxId] = key
  return feature === 'thread' &&
    account === accountId &&
    kind === 'list' &&
    typeof mailboxId === 'string'
    ? mailboxId
    : null
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
 * - when the changes cannot be computed, the email lists are cut to their
 *   first page and refetched, the mailboxes refetched.
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
    return cache
      .findAll({ queryKey: threadKeys.all(accountId) })
      .map(query => query.queryKey)
      .filter(key => mailboxIdOfList(key, accountId) !== null)
  }

  function emailListStates(): Set<string> {
    const states = new Set<string>()
    for (const key of emailListKeys()) {
      const data = queryClient.getQueryData<EmailListData>(key)
      data?.pages.forEach(page => states.add(page.state))
    }
    return states
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

  /** The changes cannot be computed: first pages and opened emails again */
  function refetchEmails(): void {
    for (const key of emailListKeys()) {
      queryClient.setQueryData<EmailListData>(key, data =>
        data ? keepFirstPage(data) : data
      )
    }
    queryClient
      .invalidateQueries({ queryKey: threadKeys.all(accountId) })
      .catch(logError)
    refetchEmailDetails()
  }

  function applyEmailChanges(changes: EmailChanges): void {
    for (const key of emailListKeys()) {
      const mailboxId = mailboxIdOfList(key, accountId)
      if (mailboxId === null) continue
      queryClient.setQueryData<EmailListData>(key, data =>
        data ? patchEmailList(data, mailboxId, changes) : data
      )
    }
    for (const [key] of queryClient.getQueriesData<EmailDetail | null>({
      queryKey: emailKeys.all(accountId)
    })) {
      queryClient.setQueryData<EmailDetail | null>(key, detail =>
        detail === undefined ? detail : patchEmailDetail(detail, changes)
      )
    }
  }

  async function synchronize(types: ReadonlySet<SyncedType>): Promise<void> {
    const mailboxes = types.has('Mailbox')
      ? queryClient.getQueryData<MailboxListData>(mailboxKeys.list(accountId))
      : undefined
    let emailStates = types.has('Email') ? [...emailListStates()] : []
    if (types.has('Email') && emailStates.length === 0) refetchEmailDetails()
    if (emailStates.length > MAX_EMAIL_STATES) {
      refetchEmails()
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
                  changed: changes.changed,
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
      const last = branches[branches.length - 1]
      if (branches.length < result.email.length || last === undefined) {
        refetchEmails()
      } else {
        latest.Email = last.newState
        applyEmailChanges(mergeEmailChanges(branches))
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
    if (mailboxIdOfList(key, accountId) !== null && latest.Email !== null) {
      const data = queryClient.getQueryData<EmailListData>(key)
      if (data?.pages.some(page => page.state !== latest.Email)) {
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
