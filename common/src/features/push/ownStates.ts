import type { JmapClient } from 'jmap-client-ts'

import type { SyncedType } from './pushSync'

/**
 * State changes of our own `/set` calls remembered per account and type, as
 * tmail-flutter (tf#3394): enough for the pushes of a burst of actions
 */
export const MAX_OWN_STATES = 64

export interface OwnStates {
  /**
   * Our own `/set` call moved `type` from `oldState` to `newState`, and the
   * cache already shows what it changed
   */
  record: (type: SyncedType, oldState: string, newState: string) => void
  /**
   * Whether `from` leads to `to` through our own changes only: then the
   * changes between them are already in the cache, no `/changes` needed. A
   * change made elsewhere in between breaks the chain.
   */
  leadsTo: (type: SyncedType, from: string, to: string) => boolean
  /**
   * One of our `/set` calls on `type` is on its way, whose state change will
   * be recorded: its push may come before its response (James sends it
   * first). Returns the call to make once it is answered, or failed.
   */
  track: (type: SyncedType) => () => void
  /** Whether a call `track` follows is not answered yet */
  isPending: (type: SyncedType) => boolean
  /** Resolves once no call on `type` is on its way */
  whenSettled: (type: SyncedType) => Promise<void>
  clear: () => void
}

/** Remembers the last `capacity` changes of each type, the oldest go first */
export function createOwnStates(capacity = MAX_OWN_STATES): OwnStates {
  const next = new Map<SyncedType, Map<string, string>>()
  const pending = new Map<SyncedType, number>()
  const waiting = new Map<SyncedType, (() => void)[]>()

  function isPending(type: SyncedType): boolean {
    return (pending.get(type) ?? 0) > 0
  }

  return {
    record: (type, oldState, newState) => {
      if (oldState === newState) return
      const pairs = next.get(type) ?? new Map<string, string>()
      // Re-inserted at the end: the newest
      pairs.delete(oldState)
      pairs.set(oldState, newState)
      while (pairs.size > capacity) {
        const oldest = pairs.keys().next().value
        if (oldest === undefined) break
        pairs.delete(oldest)
      }
      next.set(type, pairs)
    },
    leadsTo: (type, from, to) => {
      const pairs = next.get(type)
      if (pairs === undefined) return false
      let state = from
      // At most one step per pair: a cycle cannot loop forever
      for (let step = 0; step < pairs.size && state !== to; step++) {
        const following = pairs.get(state)
        if (following === undefined) return false
        state = following
      }
      return state === to
    },
    track: type => {
      pending.set(type, (pending.get(type) ?? 0) + 1)
      let isDone = false
      return () => {
        if (isDone) return
        isDone = true
        pending.set(type, (pending.get(type) ?? 1) - 1)
        if (isPending(type)) return
        const resolvers = waiting.get(type) ?? []
        waiting.delete(type)
        resolvers.forEach(resolve => {
          resolve()
        })
      }
    },
    isPending,
    whenSettled: type =>
      isPending(type)
        ? new Promise<void>(resolve => {
            waiting.set(type, [...(waiting.get(type) ?? []), resolve])
          })
        : Promise.resolve(),
    clear: () => {
      next.clear()
    }
  }
}

/**
 * One memory per client and account. A client lives as long as a sign-in
 * (`JmapClientProvider`): signing out, or in again, starts from nothing.
 */
const byClient = new WeakMap<JmapClient, Map<string, OwnStates>>()

/** Our own state changes on `accountId`, as `client` made them */
export function ownStatesOf(client: JmapClient, accountId: string): OwnStates {
  const accounts = byClient.get(client) ?? new Map<string, OwnStates>()
  byClient.set(client, accounts)
  const existing = accounts.get(accountId)
  if (existing) return existing
  const created = createOwnStates()
  accounts.set(accountId, created)
  return created
}
