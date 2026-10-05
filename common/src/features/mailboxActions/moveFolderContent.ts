import type { JmapClient } from 'jmap-client-ts'

import { planEmailChanges } from '@common/features/emailActions/planEmailChanges'
import { sendEmailChanges } from '@common/features/emailActions/sendEmailChanges'

export interface MoveContentOptions {
  /** Emails per request (`emailSetBatchSize`) */
  batchSize: number
  /** Capabilities added to `using` (team mailboxes) */
  extraCapabilities?: readonly string[]
  /** Also marks the emails read: they go to Spam */
  markSeen?: boolean
  /** Called with how many emails are moved so far, after each batch */
  onProgress?: (moved: number) => void
}

export interface MoveContentResult {
  /** The emails now in the destination */
  movedIds: string[]
  /** Emails the server refused to move */
  failedCount: number
  /** Why the sweep stopped early (network, server error), else null */
  error: unknown
}

/**
 * Moves every email of a folder to another, as tmail-flutter's "Move folder
 * content": `Email/query` of the next `batchSize` emails of the folder, then
 * one `Email/set` taking them out of it and into the destination, until the
 * folder is empty. The ones the server refuses stay: the next query skips
 * them. A failing request stops the sweep and is reported with what moved.
 */
export async function moveFolderContent(
  client: JmapClient,
  accountId: string,
  fromId: string,
  toId: string,
  {
    batchSize,
    extraCapabilities = [],
    markSeen = false,
    onProgress
  }: MoveContentOptions
): Promise<MoveContentResult> {
  const movedIds: string[] = []
  let failedCount = 0
  try {
    for (;;) {
      const query = await client.call(
        'Email/query',
        {
          accountId,
          filter: { inMailbox: fromId },
          sort: [{ property: 'receivedAt', isAscending: false }],
          position: failedCount,
          limit: batchSize
        },
        { extraCapabilities }
      )
      if (query.ids.length === 0) break
      const changes = planEmailChanges(
        query.ids.map(id => ({
          id,
          mailboxIds: { [fromId]: true },
          keywords: {}
        })),
        { kind: 'move', from: fromId, to: toId, markSeen }
      )
      const sent = await sendEmailChanges(client, accountId, changes, {
        batchSize: Math.max(1, changes.length),
        extraCapabilities
      })
      if (sent.error !== null) {
        return {
          movedIds,
          failedCount: failedCount + sent.failedIds.length,
          error: sent.error
        }
      }
      const failed = new Set(sent.failedIds)
      movedIds.push(...query.ids.filter(id => !failed.has(id)))
      failedCount += failed.size
      onProgress?.(movedIds.length)
    }
  } catch (error: unknown) {
    return { movedIds, failedCount, error }
  }
  return { movedIds, failedCount, error: null }
}

/** Puts back the emails `moveFolderContent` moved (undo) */
export async function undoMoveFolderContent(
  client: JmapClient,
  accountId: string,
  movedIds: readonly string[],
  fromId: string,
  toId: string,
  options: Pick<MoveContentOptions, 'batchSize' | 'extraCapabilities'>
): Promise<boolean> {
  const changes = planEmailChanges(
    movedIds.map(id => ({ id, mailboxIds: { [toId]: true }, keywords: {} })),
    { kind: 'move', from: toId, to: fromId }
  )
  const sent = await sendEmailChanges(client, accountId, changes, options)
  return sent.failedIds.length === 0 && sent.error === null
}
