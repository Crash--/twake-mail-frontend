import type { JmapClient } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import { destroyMailboxEmails } from '@common/features/emailActions/mailboxEmails'
import {
  findDescendantIds,
  isPersonalMailbox,
  isTrashMailbox
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'

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
 * `Mailbox/clear` when the server has it (not in a team mailbox), by pages of `Email/query` and
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
  // tmail-flutter does not clear the folders of a team mailbox (its
  // `Mailbox/clear` is for the folders of the user, known by their role)
  if (
    isPersonalMailbox(mailbox) &&
    client.hasCapability(LINAGORA_CAPABILITIES.mailboxClear)
  ) {
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

  if (!isTrashMailbox(mailbox)) return { deleted, subfolders: 'none' }
  const subfolders = findDescendantIds(mailboxes, mailbox.id)
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
