import type { EmailBodyPart } from 'jmap-client-ts'

function subtypeOf(part: Pick<EmailBodyPart, 'type'>): string {
  return part.type.toLowerCase().split(';')[0]?.split('/')[1] ?? ''
}

function isIcsPart(part: EmailBodyPart): boolean {
  return subtypeOf(part) === 'ics' || /\.ics$/i.test(part.name?.trim() ?? '')
}

/**
 * The blobs holding the calendar event of an email, as tmail-flutter picks
 * them: the `.ics` attachments (`application/ics`), or else the
 * `text/calendar` parts. James lists both among the attachments.
 */
export function findCalendarBlobIds(
  attachments: readonly EmailBodyPart[]
): string[] {
  const withBlob = attachments.filter(
    (part): part is EmailBodyPart & { blobId: string } =>
      typeof part.blobId === 'string' && part.blobId !== ''
  )
  const ics = withBlob.filter(isIcsPart)
  const chosen =
    ics.length > 0
      ? ics
      : withBlob.filter(part => subtypeOf(part) === 'calendar')
  return [...new Set(chosen.map(part => part.blobId))]
}

/**
 * A calendar part James lists as an attachment although it has no name:
 * the `text/calendar` alternative of an invitation, shown by the event card.
 */
export function isUnnamedCalendarPart(part: EmailBodyPart): boolean {
  return subtypeOf(part) === 'calendar' && !part.name?.trim()
}
