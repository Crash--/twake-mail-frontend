import type { JmapClient } from 'jmap-client-ts'

import { destroyMailboxEmails } from '@common/features/emailActions/mailboxEmails'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { MAILBOX_CLEAR_CAPABILITY } from '@common/jmap/linagoraMethods'

/** What happened to the subfolders of the Trash */
export type SubfoldersOutcome = 'none' | 'deleted' | 'partial' | 'failed'

export interface EmptyFolderResult {
  /** Emails destroyed */
  deleted: number
  subfolders: SubfoldersOutcome
}

export interface EmptyFolderOptions {
  batchSize: number
  /** Most method calls in one request (`maxCallsInRequest`) */
  maxCalls: number
  extraCapabilities?: readonly string[]
}

/** The descendants of a mailbox, the deepest first */
export function descendantsDeepestFirst(
  mailboxes: readonly MailboxSummary[],
  mailboxId: string
): string[] {
  const children = (parentId: string): string[] =>
    mailboxes
      .filter(mailbox => mailbox.parentId === parentId)
      .flatMap(mailbox => [...children(mailbox.id), mailbox.id])
  return children(mailboxId)
}

/**
 * Destroys mailboxes and their emails, the deepest first, one `Mailbox/set`
 * call each (a parent goes once its children went), `maxCalls` calls per
 * request. Resolves to the ids that could not be destroyed.
 */
export async function destroyMailboxes(
  client: JmapClient,
  accountId: string,
  ids: readonly string[],
  { maxCalls, extraCapabilities = [] }: Omit<EmptyFolderOptions, 'batchSize'>
): Promise<string[]> {
  const failed: string[] = []
  for (let start = 0; start < ids.length; start += maxCalls) {
    const batch = ids.slice(start, start + maxCalls)
    const results = await client.requestSettled(
      builder =>
        batch.map(id =>
          builder.call('Mailbox/set', {
            accountId,
            destroy: [id],
            onDestroyRemoveEmails: true
          })
        ),
      { extraCapabilities }
    )
    batch.forEach((id, index) => {
      const result = results[index]
      const isDestroyed =
        result?.ok === true && (result.value.destroyed ?? []).includes(id)
      const isGone =
        result?.ok === true &&
        result.value.notDestroyed?.[id]?.type === 'notFound'
      if (!isDestroyed && !isGone) failed.push(id)
    })
  }
  return failed
}

/**
 * Empties a folder as tmail-flutter: its emails go for good, with
 * `Mailbox/clear` when the server has it, by pages of `Email/query` and
 * `Email/set` destroy otherwise; the Trash also loses its subfolders.
 * Throws when the emails cannot be destroyed.
 */
export async function emptyFolder(
  client: JmapClient,
  accountId: string,
  mailbox: MailboxSummary,
  mailboxes: readonly MailboxSummary[],
  options: EmptyFolderOptions
): Promise<EmptyFolderResult> {
  let deleted: number
  if (client.hasCapability(MAILBOX_CLEAR_CAPABILITY)) {
    const response = await client.call(
      'Mailbox/clear',
      { accountId, mailboxId: mailbox.id },
      { extraCapabilities: options.extraCapabilities }
    )
    if (response.notCleared) {
      throw new Error(
        `Mailbox/clear refused: ${response.notCleared.type} ${response.notCleared.description ?? ''}`
      )
    }
    deleted = response.totalDeletedMessagesCount ?? 0
  } else {
    deleted = await destroyMailboxEmails(client, accountId, mailbox.id, options)
  }

  if (mailbox.role !== 'trash') return { deleted, subfolders: 'none' }
  const subfolders = descendantsDeepestFirst(mailboxes, mailbox.id)
  if (subfolders.length === 0) return { deleted, subfolders: 'none' }
  try {
    const failed = await destroyMailboxes(
      client,
      accountId,
      subfolders,
      options
    )
    return {
      deleted,
      subfolders:
        failed.length === 0
          ? 'deleted'
          : failed.length < subfolders.length
            ? 'partial'
            : 'failed'
    }
  } catch (error: unknown) {
    console.error('[mailbox] Cannot delete the subfolders', error)
    return { deleted, subfolders: 'failed' }
  }
}
