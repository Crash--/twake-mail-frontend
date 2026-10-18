import type { Session } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import { findAncestorIds } from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'

declare module 'jmap-client-ts' {
  interface Mailbox {
    /**
     * James shares extension: who may do what in the mailbox, as IMAP ACL
     * rights by user (`anyone` for everybody); written through
     * `sharedWith/<user>`. Not in jmap-client-ts yet.
     */
    rights?: Record<string, string[]>
  }
}

/**
 * Sub-addressing, as tmail-flutter (TF-3189): when anyone may post in a
 * personal folder (the `p` right of `anyone`), the mail sent to
 * `user+Folder@domain` lands in that folder instead of the Inbox.
 */
export const ANYONE = 'anyone'
export const POSTING_RIGHT = 'p'

/** James nests mailbox names with dots: the detail of a subfolder */
const PATH_SEPARATOR = '.'

function readSubaddressingSupported(properties: unknown): boolean | null {
  if (
    typeof properties !== 'object' ||
    properties === null ||
    !('subaddressingSupported' in properties)
  ) {
    return null
  }
  const supported = properties.subaddressingSupported
  return typeof supported === 'boolean' ? supported : null
}

/**
 * Whether the server delivers sub-addresses: `subaddressingSupported` of the
 * shares capability, of the account first, as tmail-flutter reads it
 */
export function isSubaddressingSupported(
  session: Pick<Session, 'capabilities' | 'accounts'>,
  accountId: string
): boolean {
  const id = LINAGORA_CAPABILITIES.jamesShares
  return (
    readSubaddressingSupported(
      session.accounts[accountId]?.accountCapabilities[id]
    ) ??
    readSubaddressingSupported(session.capabilities[id]) ??
    false
  )
}

/** Whether anyone may post in the mailbox: sub-addressing is on */
export function isSubaddressingAllowed(
  rights: Record<string, string[]> | undefined
): boolean {
  return rights?.[ANYONE]?.includes(POSTING_RIGHT) === true
}

/** The rights of `anyone` with the posting right given or taken back */
export function anyoneRightsWith(
  rights: Record<string, string[]> | undefined,
  isAllowed: boolean
): string[] {
  const others = (rights?.[ANYONE] ?? []).filter(
    right => right !== POSTING_RIGHT
  )
  return isAllowed ? [...others, POSTING_RIGHT] : others
}

/**
 * The detail naming a folder in its sub-address: its path from the top,
 * by the names the server knows (not the translated ones of the system
 * folders), joined with dots
 */
export function subaddressDetail(
  mailboxes: readonly MailboxSummary[],
  mailboxId: string
): string | null {
  const byId = new Map(mailboxes.map(mailbox => [mailbox.id, mailbox]))
  if (!byId.has(mailboxId)) return null
  return [...findAncestorIds(mailboxes, mailboxId).reverse(), mailboxId]
    .map(id => byId.get(id)?.name ?? '')
    .join(PATH_SEPARATOR)
}

/**
 * `local+detail@domain`, as tmail-flutter writes it (without its angle
 * brackets); null for an address without a local part or a domain, or an
 * empty detail
 */
export function subaddress(email: string, detail: string): string | null {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1 || detail === '') return null
  return `${email.slice(0, at)}+${detail}${email.slice(at)}`
}
