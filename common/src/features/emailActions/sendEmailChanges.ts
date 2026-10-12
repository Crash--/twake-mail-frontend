import type { JmapClient, Session } from 'jmap-client-ts'

import {
  toEmailPatch,
  type EmailChange,
  type EmailPatch
} from './planEmailChanges'

/** Most emails sent in one `Email/set`, as tmail-flutter: at most 50 */
export const MAX_EMAILS_PER_SET = 50

/** `maxObjectsInSet` of the session, capped at `MAX_EMAILS_PER_SET` */
export function emailSetBatchSize(session: Session): number {
  const core: unknown = session.capabilities['urn:ietf:params:jmap:core']
  const max =
    typeof core === 'object' &&
    core !== null &&
    'maxObjectsInSet' in core &&
    typeof core.maxObjectsInSet === 'number'
      ? core.maxObjectsInSet
      : MAX_EMAILS_PER_SET
  return Math.max(1, Math.min(max, MAX_EMAILS_PER_SET))
}

export interface SendResult {
  /** Emails the server did not change: refused, or never sent */
  failedIds: string[]
  /** Why, when the request itself failed (network, server error) */
  error: unknown
}

export interface SendOptions {
  batchSize: number
  /** Capabilities added to `using` (team mailboxes) */
  extraCapabilities?: readonly string[]
  /** After each request: how many emails were sent so far */
  onProgress?: (sent: number) => void
}

/**
 * Sends `changes` with `Email/set`, `batchSize` emails per request, one
 * request after the other: updates as path patches, destructions as
 * `destroy`. A batch refused in part reports its ids; a request that fails
 * stops there, the rest counting as failed with it.
 */
export async function sendEmailChanges(
  client: JmapClient,
  accountId: string,
  changes: readonly EmailChange[],
  { batchSize, extraCapabilities = [], onProgress }: SendOptions
): Promise<SendResult> {
  const failedIds: string[] = []
  for (let start = 0; start < changes.length; start += batchSize) {
    const batch = changes.slice(start, start + batchSize)
    const update: Record<string, EmailPatch> = {}
    const destroy: string[] = []
    for (const change of batch) {
      const patch = toEmailPatch(change)
      if (patch === null) destroy.push(change.before.id)
      else update[change.before.id] = patch
    }
    try {
      const response = await client.call(
        'Email/set',
        {
          accountId,
          ...(Object.keys(update).length > 0 ? { update } : {}),
          ...(destroy.length > 0 ? { destroy } : {})
        },
        { extraCapabilities }
      )
      failedIds.push(
        ...Object.keys(response.notUpdated ?? {}),
        ...Object.keys(response.notDestroyed ?? {})
      )
      onProgress?.(start + batch.length)
    } catch (error: unknown) {
      failedIds.push(...changes.slice(start).map(change => change.before.id))
      return { failedIds, error }
    }
  }
  return { failedIds, error: null }
}
