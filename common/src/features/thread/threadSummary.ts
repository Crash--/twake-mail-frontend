import type { EmailAddress } from 'jmap-client-ts'

import { formatAddressName } from '@common/features/email/addresses'
import {
  DRAFT,
  FLAGGED,
  hasKeyword,
  SEEN
} from '@common/features/email/keywords'
import { isPersonalMailbox } from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'

import type { MessageIdentity, ThreadMember } from './queries'

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

/**
 * An email the user received from someone else: not one they sent (in Sent,
 * or from their address) nor a draft of theirs
 */
export function isReceivedFromOthers(
  email: Pick<ThreadMember, 'mailboxIds' | 'from' | 'keywords'>,
  sentId: string | null,
  ownAddress: string
): boolean {
  const isSent = sentId !== null && sentId in email.mailboxIds
  const isFromMe = (email.from ?? []).some(address =>
    isOwnAddress(address, ownAddress)
  )
  return !isSent && !isFromMe && !hasKeyword(email, DRAFT)
}

/** The folders of the team mailboxes the user belongs to, by id */
export function getTeamMailboxIds(
  mailboxes: readonly Pick<MailboxSummary, 'id' | 'namespace'>[]
): ReadonlySet<string> {
  return new Set(
    mailboxes
      .filter(mailbox => !isPersonalMailbox(mailbox))
      .map(mailbox => mailbox.id)
  )
}

function isTeamCopy(
  email: Pick<ThreadMember, 'mailboxIds'>,
  teamMailboxIds: ReadonlySet<string>
): boolean {
  const mailboxIds = Object.keys(email.mailboxIds)
  return mailboxIds.length > 0 && mailboxIds.every(id => teamMailboxIds.has(id))
}

/**
 * A mail a team mailbox sent to one of its members has two copies in the
 * member's account, the team's in its Sent and the member's, and
 * tmail-backend puts them in the same thread. The conversation shows the
 * side of `keptEmailId` (the email opened, the email of the row): a copy of
 * the other side whose Message-ID is one of this side is hidden, so that the
 * mail is shown, counted and acted on once.
 */
export function withoutTeamCopies<
  T extends Pick<ThreadMember, 'id' | 'mailboxIds'> & MessageIdentity
>(
  emails: readonly T[],
  keptEmailId: string,
  teamMailboxIds: ReadonlySet<string>
): T[] {
  const kept = emails.find(email => email.id === keptEmailId)
  const isTeamSide = kept !== undefined && isTeamCopy(kept, teamMailboxIds)
  const isOnSide = (email: T): boolean =>
    isTeamCopy(email, teamMailboxIds) === isTeamSide
  const sideMessageIds = new Set(
    emails.filter(isOnSide).flatMap(email => email.messageId ?? [])
  )
  return emails.filter(
    email =>
      isOnSide(email) ||
      !(email.messageId ?? []).some(id => sideMessageIds.has(id))
  )
}

/** Where the row of a conversation stands */
export interface ThreadContext {
  /** The address of the user, said "me" */
  ownAddress: string
  meLabel: string
  /** The Sent mailbox, whose copies of emails sent to oneself are not counted */
  sentId: string | null
  /** The folders of the team mailboxes, whose copies of a mail are hidden */
  teamMailboxIds: ReadonlySet<string>
  /** The email the row stands for: counted, whatever it is */
  rowEmailId: string
}

/**
 * The summary of a conversation from its emails (`members`, the oldest
 * first): its participants, as most webmails write them ("Alice, Bob, me"),
 * its state, the state of any of its emails, and the number of messages the
 * conversation shows (not the copy in Sent of an email sent to oneself).
 * The copies of a team mailbox on the other side than the row are left out.
 */
export function summarizeThread(
  threadMembers: readonly ThreadMember[],
  { ownAddress, meLabel, sentId, teamMailboxIds, rowEmailId }: ThreadContext
): ThreadSummary {
  const members = withoutTeamCopies(threadMembers, rowEmailId, teamMailboxIds)
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
