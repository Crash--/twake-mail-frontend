import type { EmailAddress } from 'jmap-client-ts'

import type { Recipient } from './recipients'

/** What a composer answers an email with */
export type ReplyAction = 'reply' | 'replyAll' | 'replyToList' | 'forward'

export const REPLY_ACTIONS: readonly ReplyAction[] = [
  'reply',
  'replyAll',
  'replyToList',
  'forward'
]

/** The addresses of the email answered */
export interface ReplySource {
  from: readonly EmailAddress[] | null
  to: readonly EmailAddress[] | null
  cc: readonly EmailAddress[] | null
  bcc: readonly EmailAddress[] | null
  replyTo: readonly EmailAddress[] | null
  /** `header:List-Post:asURLs`: the posting addresses of a mailing list */
  listPost: readonly string[] | null
}

export interface ReplyRecipients {
  to: Recipient[]
  cc: Recipient[]
  bcc: Recipient[]
}

/** Whether an address is one of the user's (case insensitive) */
export type IsSelf = (email: string) => boolean

/** The user's addresses: the account name, and the ones of its identities */
export function makeIsSelf(addresses: readonly string[]): IsSelf {
  const own = new Set(
    addresses
      .filter(address => address.includes('@'))
      .map(address => address.trim().toLowerCase())
  )
  return email => own.has(email.trim().toLowerCase())
}

function toRecipients(
  addresses: readonly EmailAddress[] | null | undefined
): Recipient[] {
  return (addresses ?? []).map(address => ({
    name: address.name ?? null,
    email: address.email
  }))
}

/** Without empty addresses and repeats (the first one, with its name, wins) */
function unique(recipients: readonly Recipient[]): Recipient[] {
  const seen = new Set<string>()
  return recipients.filter(recipient => {
    const key = recipient.email.trim().toLowerCase()
    if (key === '' || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function withoutSelf(
  recipients: readonly Recipient[],
  isSelf: IsSelf
): Recipient[] {
  return unique(recipients).filter(recipient => !isSelf(recipient.email))
}

function addressesOf(value: string): Recipient[] {
  return value
    .split(',')
    .map(part => {
      try {
        return decodeURIComponent(part).trim()
      } catch {
        return part.trim()
      }
    })
    .filter(email => email.includes('@'))
    .map(email => ({ name: null, email }))
}

/**
 * The recipients of the `mailto:` URLs of a `List-Post` header (RFC 2369):
 * the address, and its `cc` and `bcc` fields. Other URLs (`http:`) and
 * `NO` are no list.
 */
export function listPostRecipients(
  listPost: readonly string[] | null
): ReplyRecipients {
  const result: ReplyRecipients = { to: [], cc: [], bcc: [] }
  for (const url of listPost ?? []) {
    const match = /^\s*<?mailto:([^?>]*)(?:\?([^>]*))?>?\s*$/i.exec(url)
    if (!match) continue
    result.to.push(...addressesOf(match[1] ?? ''))
    const query = new URLSearchParams(match[2] ?? '')
    for (const [name, value] of query) {
      const field = name.toLowerCase()
      if (field === 'to') result.to.push(...addressesOf(value))
      if (field === 'cc') result.cc.push(...addressesOf(value))
      if (field === 'bcc') result.bcc.push(...addressesOf(value))
    }
  }
  return {
    to: unique(result.to),
    cc: unique(result.cc),
    bcc: unique(result.bcc)
  }
}

export function hasListPost(source: Pick<ReplySource, 'listPost'>): boolean {
  const list = listPostRecipients(source.listPost)
  return list.to.length + list.cc.length + list.bcc.length > 0
}

function keyOf(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * The user sent it (tmail-flutter ADR 0064): it comes from one of their
 * addresses and is not addressed to another one of them. A team mailbox
 * identity is shared: an email a teammate sent as the team to the user
 * comes from one of the user's addresses, yet the user received it.
 */
export function isSentBySelf(
  source: Pick<ReplySource, 'from' | 'to' | 'cc' | 'bcc'>,
  isSelf: IsSelf
): boolean {
  const from = toRecipients(source.from)
  if (!from.some(address => isSelf(address.email))) return false
  const senders = new Set(from.map(address => keyOf(address.email)))
  const recipients = [
    ...toRecipients(source.to),
    ...toRecipients(source.cc),
    ...toRecipients(source.bcc)
  ]
  return !recipients.some(
    recipient => isSelf(recipient.email) && !senders.has(keyOf(recipient.email))
  )
}

/**
 * Who the user is when answering: the sender of an email they received is
 * someone else, even when it is an identity they share (a team mailbox).
 */
function selfWhenAnswering(source: ReplySource, isSelf: IsSelf): IsSelf {
  if (isSentBySelf(source, isSelf)) return isSelf
  const senders = new Set(
    toRecipients(source.from).map(address => keyOf(address.email))
  )
  return email => isSelf(email) && !senders.has(keyOf(email))
}

/**
 * Whether "Reply all" reaches more than "Reply": more than one address
 * other than the user's among the sender and the recipients
 * (tmail-flutter's `getCountMailAddressWithoutMe`).
 */
export function canReplyAll(source: ReplySource, isSelf: IsSelf): boolean {
  const everyone = [
    ...toRecipients(source.from),
    ...toRecipients(source.to),
    ...toRecipients(source.cc),
    ...toRecipients(source.bcc)
  ]
  return withoutSelf(everyone, selfWhenAnswering(source, isSelf)).length > 1
}

/**
 * The recipients of an answer, by tmail-flutter's rules (ADR 0064 and 0065,
 * presentation_email_extension.dart):
 *
 * - **reply**: to an email the user sent, its To (Reply-To ignored); to a
 *   list email, the sender; otherwise the Reply-To, else the sender;
 * - **reply to list**: the addresses of `List-Post`;
 * - **reply all**: to an email the user sent, its To, Cc and Bcc; to a list
 *   email, Reply-To + sender + To; otherwise Reply-To (else the sender) +
 *   To; Cc and Bcc kept;
 * - **forward**: nobody.
 *
 * The user's own addresses are left out everywhere except in a plain reply
 * to an email they sent (they may have sent it to themselves). Unlike
 * tmail-flutter, every address of the user counts (identities, not only the
 * account name) and addresses compare case insensitively. The sender of an
 * email the user received is kept, even when it is a team mailbox identity
 * the user shares.
 */
export function replyRecipients(
  source: ReplySource,
  action: ReplyAction,
  isSelf: IsSelf
): ReplyRecipients {
  const lists = recipientsFor(source, action, isSelf)
  // An address once: in To, else in Cc, else in Bcc
  const taken = new Set(
    lists.to.map(recipient => recipient.email.toLowerCase())
  )
  const cc = lists.cc.filter(
    recipient => !taken.has(recipient.email.toLowerCase())
  )
  cc.forEach(recipient => taken.add(recipient.email.toLowerCase()))
  const bcc = lists.bcc.filter(
    recipient => !taken.has(recipient.email.toLowerCase())
  )
  return { to: lists.to, cc, bcc }
}

function recipientsFor(
  source: ReplySource,
  action: ReplyAction,
  isSelf: IsSelf
): ReplyRecipients {
  const none: ReplyRecipients = { to: [], cc: [], bcc: [] }
  const from = toRecipients(source.from)
  const to = toRecipients(source.to)
  const cc = toRecipients(source.cc)
  const bcc = toRecipients(source.bcc)
  const replyTo = toRecipients(source.replyTo)
  const isSender = isSentBySelf(source, isSelf)
  const isUser = selfWhenAnswering(source, isSelf)
  const isList = hasListPost(source)
  switch (action) {
    case 'forward':
      return none
    case 'replyToList': {
      const list = listPostRecipients(source.listPost)
      return {
        to: withoutSelf(list.to, isSelf),
        cc: withoutSelf(list.cc, isSelf),
        bcc: withoutSelf(list.bcc, isSelf)
      }
    }
    case 'reply':
      if (isSender) return { ...none, to: unique(to) }
      return {
        ...none,
        to: withoutSelf(isList || replyTo.length === 0 ? from : replyTo, isUser)
      }
    case 'replyAll': {
      if (isSender) {
        return {
          to: withoutSelf(to, isSelf),
          cc: withoutSelf(cc, isSelf),
          bcc: withoutSelf(bcc, isSelf)
        }
      }
      const head = isList
        ? [...replyTo, ...from]
        : replyTo.length > 0
          ? replyTo
          : from
      return {
        to: withoutSelf([...head, ...to], isUser),
        cc: withoutSelf(cc, isUser),
        bcc: withoutSelf(bcc, isUser)
      }
    }
  }
}
