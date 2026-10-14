import type { RecipientFieldChip } from '@/ds/RecipientField/RecipientField'

import { formatRecipient, isValidEmail, type Recipient } from './recipients'

/**
 * The chips of recipients: their name or address, a one letter avatar on
 * the gradient of the address (decorative: the label is next to it), invalid
 * ones flagged, as are the addresses the server refused to send to
 */
export function recipientChips(
  recipients: readonly Recipient[],
  refused: readonly string[] = []
): RecipientFieldChip[] {
  const refusedEmails = new Set(refused.map(email => email.toLowerCase()))
  return recipients.map(recipient => {
    const label = recipient.name ?? recipient.email
    return {
      id: recipient.email,
      label,
      title: formatRecipient(recipient),
      isInvalid:
        !isValidEmail(recipient.email) ||
        refusedEmails.has(recipient.email.toLowerCase()),
      avatar: label,
      avatarKey: recipient.email,
      name: recipient.name,
      address: recipient.email
    }
  })
}
