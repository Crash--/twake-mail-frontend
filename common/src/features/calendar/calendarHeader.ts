/**
 * An email carrying a calendar event, as tmail-flutter tells it in its
 * lists (`PresentationEmail.hasCalendarEvent`): tmail-backend writes the
 * UID of the event in this header of the invitations and their answers
 */
export const CALENDAR_EVENT_HEADER = 'header:X-MEETING-UID:asText'

/** An email with that header, null when absent */
export type CalendarEventHeader = Partial<
  Record<typeof CALENDAR_EVENT_HEADER, string | null>
>

/** Whether the email carries a calendar event */
export function hasCalendarEvent(email: CalendarEventHeader): boolean {
  return (email[CALENDAR_EVENT_HEADER] ?? '').trim() !== ''
}
