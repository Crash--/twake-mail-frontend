import type { EmailAddress } from 'jmap-client-ts'

import { formatAddressName } from '@common/features/email/addresses'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'

import type { ThreadMember } from './queries'

/** What the row of a conversation shows of all its emails */
export interface ThreadSummary {
  /** Every email of the conversation, the oldest first: what actions target */
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
 * The summary of a conversation from its emails (`members`, the oldest
 * first): its participants, as most webmails write them ("Alice, Bob, me"),
 * and its state, the state of any of its emails.
 */
export function summarizeThread(
  members: readonly ThreadMember[],
  ownAddress: string,
  meLabel: string
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
    count: members.length,
    participants,
    isUnread: members.some(member => !hasKeyword(member, SEEN)),
    isStarred: members.some(member => hasKeyword(member, FLAGGED)),
    hasAttachment: members.some(member => member.hasAttachment)
  }
}
