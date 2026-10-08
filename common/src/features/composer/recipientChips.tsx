import type { RecipientFieldChip } from '@/ds/RecipientField/RecipientField'

import { formatRecipient, isValidEmail, type Recipient } from './recipients'

/**
 * The chips of recipients: their name or address, a one letter avatar on
 * the gradient of the address (decorative: the label is next to it), invalid
 * ones flagged
 */
export function recipientChips(
  recipients: readonly Recipient[]
): RecipientFieldChip[] {
  return recipients.map(recipient => {
    const label = recipient.name ?? recipient.email
    return {
      id: recipient.email,
      label,
      title: formatRecipient(recipient),
      isInvalid: !isValidEmail(recipient.email),
      avatar: label,
      avatarKey: recipient.email
    }
  })
}
