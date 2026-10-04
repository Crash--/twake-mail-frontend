import type { EmailFilterCondition, JmapClient } from 'jmap-client-ts'

import type { TargetEmail } from './planEmailChanges'

/** Emails asked per `Email/query` when going through a whole mailbox */
export const MAILBOX_PAGE_SIZE = 256

export interface MailboxEmailsOptions {
  extraCapabilities?: readonly string[]
  /** More conditions, e.g. `{ notKeyword: '$seen' }` */
  filter?: Omit<EmailFilterCondition, 'inMailbox'>
}

/**
 * Every email of a mailbox (matching `filter`), with what an action needs
 * (`mailboxIds`, `keywords`): one request per page, `Email/query` then
 * `Email/get` of its ids by back-reference. James caps the page size: it
 * goes on until a page comes back shorter than the limit it applied.
 */
export async function fetchMailboxEmails(
  client: JmapClient,
  accountId: string,
  mailboxId: string,
  { extraCapabilities = [], filter = {} }: MailboxEmailsOptions = {}
): Promise<TargetEmail[]> {
  const emails = new Map<string, TargetEmail>()
  for (let position = 0; ;) {
    const [query, found] = await client.request(
      builder => {
        const queryCall = builder.call('Email/query', {
          accountId,
          filter: { ...filter, inMailbox: mailboxId },
          sort: [{ property: 'receivedAt', isAscending: false }],
          position,
          limit: MAILBOX_PAGE_SIZE
        })
        const getCall = builder.call('Email/get', {
          accountId,
          '#ids': queryCall.ref('/ids'),
          properties: ['id', 'mailboxIds', 'keywords']
        })
        return [queryCall, getCall]
      },
      { extraCapabilities }
    )
    for (const email of found.list) emails.set(email.id, email)
    const limit = query.limit ?? MAILBOX_PAGE_SIZE
    if (query.ids.length === 0 || query.ids.length < limit) break
    position += query.ids.length
  }
  return [...emails.values()]
}

/**
 * Destroys every email of a mailbox, a page at a time, each in one request:
 * `Email/query` then `Email/set` destroying its ids by back-reference.
 * Stops when the mailbox is empty, or when a page destroys nothing (refused).
 * Resolves to how many went.
 */
export async function destroyMailboxEmails(
  client: JmapClient,
  accountId: string,
  mailboxId: string,
  {
    batchSize,
    extraCapabilities = []
  }: { batchSize: number; extraCapabilities?: readonly string[] }
): Promise<number> {
  let destroyed = 0
  for (;;) {
    const [query, set] = await client.request(
      builder => {
        const queryCall = builder.call('Email/query', {
          accountId,
          filter: { inMailbox: mailboxId },
          limit: batchSize
        })
        const setCall = builder.call('Email/set', {
          accountId,
          '#destroy': queryCall.ref('/ids')
        })
        return [queryCall, setCall]
      },
      { extraCapabilities }
    )
    const count = set.destroyed?.length ?? 0
    destroyed += count
    if (query.ids.length === 0 || count === 0) return destroyed
  }
}
