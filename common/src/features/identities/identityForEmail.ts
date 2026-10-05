import type { EmailAddress } from 'jmap-client-ts'

import { teamMailboxAddress } from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'

import type { IdentitySummary } from './queries'

/** What an email says of who received it */
export interface ReceivedEmail {
  mailboxIds: Record<string, true>
  to: readonly EmailAddress[] | null
  cc: readonly EmailAddress[] | null
  bcc?: readonly EmailAddress[] | null
}

/** The identity to answer an email with, and the address it reached */
export interface IdentityChoice {
  /** Null when the account has no identity */
  identity: IdentitySummary | null
  /**
   * The address that received the email: the team mailbox it is in, or
   * the address of the identity found among its recipients; null when
   * neither is known (the default identity is taken)
   */
  receivedAt: string | null
}

function sameAddress(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

/**
 * The identity matching the mailbox or the recipient that received an
 * email, for its read receipt and the answers to it:
 *
 * 1. in a team mailbox (or one of its folders), the identity of the team
 *    mailbox address, as tmail-flutter `_setUpDefaultIdentityForTeamMailbox`;
 * 2. else the identity whose address is in To or Cc, then in Bcc, without
 *    case; of several, the first in the order of `identities`
 *    (`sortIdentities`: the lowest `sortOrder`);
 * 3. else the default identity, the first one.
 *
 * tmail-flutter answers with the default identity whatever the recipients:
 * the second rule is an intended difference.
 */
export function identityForEmail(
  email: ReceivedEmail,
  {
    identities,
    mailboxes
  }: {
    /** Sorted, the default one first (`sortIdentities`) */
    identities: readonly IdentitySummary[]
    mailboxes: readonly MailboxSummary[]
  }
): IdentityChoice {
  const fallback = identities[0] ?? null
  const teamAddress =
    mailboxes
      .filter(mailbox => mailbox.id in email.mailboxIds)
      .map(teamMailboxAddress)
      .find(address => address !== null) ?? null
  if (teamAddress !== null) {
    return {
      identity:
        identities.find(identity => sameAddress(identity.email, teamAddress)) ??
        fallback,
      receivedAt: teamAddress
    }
  }
  // To and Cc, then Bcc (the copy the user was sent in hidden copy)
  const visible = [...(email.to ?? []), ...(email.cc ?? [])]
  for (const recipients of [visible, email.bcc ?? []]) {
    const identity = identities.find(candidate =>
      recipients.some(address => sameAddress(address.email, candidate.email))
    )
    if (identity !== undefined) {
      return { identity, receivedAt: identity.email }
    }
  }
  return { identity: fallback, receivedAt: null }
}
