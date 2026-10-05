import type { EmailAddress } from 'jmap-client-ts'

import { formatAddressName } from '@common/features/email/addresses'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'

import type { ThreadMember } from './queries'

/** What the row of a conversation shows of all its emails */
export interface ThreadSummary {
  /**
   * Every email of the conversation, the oldest first: what actions target,
   * the copies in Sent included
   */
  members: readonly ThreadMember[]
  count: number
  /** The senders, each once, in the order they wrote; "me" for the user */
  participants: readonly string[]
  /** One of its emails is unread, starred, has an attachment */
  isUnread: boolean
  isStarred: boolean
  hasAttachment: boolean
}

function isOwnAddress(address: EmailAddress, ownAddress: string): boolean {
  return address.email.toLowerCase() === ownAddress.toLowerCase()
}

/**
 * The copy in Sent of an email the user sent to themselves duplicates the
 * one received: tmail-flutter hides it (`checkEmailValidForThreadDetail`)
 */
export function isOwnSentCopy(
  email: Pick<ThreadMember, 'mailboxIds' | 'from' | 'to'>,
  sentId: string | null,
  ownAddress: string
): boolean {
  const isMine = (address: EmailAddress): boolean =>
    isOwnAddress(address, ownAddress)
  return (
    sentId !== null &&
    sentId in email.mailboxIds &&
    (email.from ?? []).some(isMine) &&
    (email.to ?? []).some(isMine)
  )
}

/** Where the row of a conversation stands */
export interface ThreadContext {
  /** The address of the user, said "me" */
  ownAddress: string
  meLabel: string
  /** The Sent mailbox, whose copies of emails sent to oneself are not counted */
  sentId: string | null
  /** The email the row stands for: counted, whatever it is */
  rowEmailId: string
}

/**
 * The summary of a conversation from its emails (`members`, the oldest
 * first): its participants, as most webmails write them ("Alice, Bob, me"),
 * its state, the state of any of its emails, and the number of messages the
 * conversation shows (not the copy in Sent of an email sent to oneself).
 */
export function summarizeThread(
  members: readonly ThreadMember[],
  { ownAddress, meLabel, sentId, rowEmailId }: ThreadContext
): ThreadSummary {
  const participants: string[] = []
  for (const member of members) {
    for (const address of member.from ?? []) {
      const name = isOwnAddress(address, ownAddress)
        ? meLabel
        : formatAddressName(address)
      if (!participants.includes(name)) participants.push(name)
    }
  }
  return {
    members,
    count: members.filter(
      member =>
        member.id === rowEmailId || !isOwnSentCopy(member, sentId, ownAddress)
    ).length,
    participants,
    isUnread: members.some(member => !hasKeyword(member, SEEN)),
    isStarred: members.some(member => hasKeyword(member, FLAGGED)),
    hasAttachment: members.some(member => member.hasAttachment)
  }
}
