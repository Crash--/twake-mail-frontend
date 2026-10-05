import type {
  CalendarEvent,
  CalendarEventAttendanceStatus,
  CalendarEventParticipant
} from 'jmap-client-ts/linagora'

import type { IsSelf } from '@common/features/composer/replyRecipients'

/** iTIP methods (RFC 5546) the card knows */
export type CalendarMethod =
  | 'REQUEST'
  | 'ADD'
  | 'REFRESH'
  | 'CANCEL'
  | 'REPLY'
  | 'COUNTER'
  | 'DECLINECOUNTER'
  | 'PUBLISH'

const METHODS: readonly CalendarMethod[] = [
  'REQUEST',
  'ADD',
  'REFRESH',
  'CANCEL',
  'REPLY',
  'COUNTER',
  'DECLINECOUNTER',
  'PUBLISH'
]

export function methodOf(event: CalendarEvent): CalendarMethod | null {
  const method = (event.method ?? '').trim().toUpperCase()
  return (METHODS as readonly string[]).includes(method)
    ? (method as CalendarMethod) // SAFETY: membership checked above
    : null
}

/** A participation status (`PARTSTAT`), whatever its case */
export type ParticipationStatus =
  'needsAction' | 'accepted' | 'declined' | 'tentative' | 'delegated'

/**
 * tmail-backend gives `PARTSTAT` as written in the file: `NEEDS-ACTION`,
 * `needs-action`…
 */
export function participationStatusOf(
  participant: Pick<CalendarEventParticipant, 'participationStatus'>
): ParticipationStatus | null {
  switch ((participant.participationStatus ?? '').trim().toLowerCase()) {
    case 'needs-action':
      return 'needsAction'
    case 'accepted':
      return 'accepted'
    case 'declined':
      return 'declined'
    case 'tentative':
      return 'tentative'
    case 'delegated':
      return 'delegated'
    default:
      return null
  }
}

/** The answer of the user to an invitation */
export type CalendarReply = 'yes' | 'maybe' | 'no'

/** `CalendarEventAttendance/get` as the answer it stands for, if any */
export function replyOfAttendance(
  status: CalendarEventAttendanceStatus | null
): CalendarReply | null {
  switch (status) {
    case 'accepted':
      return 'yes'
    case 'tentativelyAccepted':
      return 'maybe'
    case 'rejected':
      return 'no'
    default:
      return null
  }
}

/** What the banner on top of the card says, as tmail-flutter words it */
export type CalendarBannerKind =
  | 'invited'
  | 'updated'
  | 'canceled'
  | 'accepted'
  | 'tentative'
  | 'declined'
  | 'counter'
  | 'counterDeclined'

export interface CalendarBanner {
  kind: CalendarBannerKind
  /** Who did it, null when the text names nobody (counter declined) */
  actor: string | null
}

/** The text without its surrounding blanks, null when nothing is left */
export function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

function addressOf(mailto: string | null | undefined): string {
  return (mailto ?? '')
    .replace(/^mailto:/i, '')
    .trim()
    .toLowerCase()
}

function displayName(person: {
  name?: string | null
  mailto?: string | null
}): string {
  return textOrNull(person.name) ?? addressOf(person.mailto)
}

/**
 * The banner of an event: the organizer for an invitation, an update or a
 * cancellation; the participant who wrote the email (its From or Reply-To)
 * for an answer or a counter proposal. A new sequence of a request is an
 * update (tmail-flutter only says so for `REFRESH`).
 */
export function bannerOf(
  event: CalendarEvent,
  senders: readonly string[],
  anAttendee: string
): CalendarBanner | null {
  const method = methodOf(event)
  const organizer = event.organizer ? displayName(event.organizer) : ''
  const fromSender = (): string => {
    const own = new Set(senders.map(address => address.trim().toLowerCase()))
    const participant = (event.participants ?? []).find(candidate =>
      own.has(addressOf(candidate.mailto))
    )
    return participant ? displayName(participant) : anAttendee
  }
  switch (method) {
    case 'REQUEST':
    case 'ADD':
      if (!organizer) return null
      return {
        kind: (event.sequence ?? 0) > 0 ? 'updated' : 'invited',
        actor: organizer
      }
    case 'REFRESH':
      return organizer ? { kind: 'updated', actor: organizer } : null
    case 'CANCEL':
      return organizer ? { kind: 'canceled', actor: organizer } : null
    case 'COUNTER':
      return { kind: 'counter', actor: fromSender() }
    case 'DECLINECOUNTER':
      return { kind: 'counterDeclined', actor: null }
    case 'REPLY': {
      const own = new Set(senders.map(address => address.trim().toLowerCase()))
      const participant = (event.participants ?? []).find(candidate =>
        own.has(addressOf(candidate.mailto))
      )
      const status = participant ? participationStatusOf(participant) : null
      const kind =
        status === 'accepted'
          ? 'accepted'
          : status === 'tentative'
            ? 'tentative'
            : status === 'declined'
              ? 'declined'
              : null
      return kind ? { kind, actor: fromSender() } : null
    }
    default:
      return null
  }
}

export interface CalendarPerson {
  name: string | null
  email: string
  status: ParticipationStatus | null
  isOrganizer: boolean
}

/**
 * Who the event gathers: the organizer first, then the participants other
 * than the organizer; people without a name nor an address are left out.
 */
export function peopleOf(event: CalendarEvent): CalendarPerson[] {
  const organizerEmail = addressOf(event.organizer?.mailto)
  const organizerAsParticipant = (event.participants ?? []).find(
    participant =>
      organizerEmail !== '' && addressOf(participant.mailto) === organizerEmail
  )
  const organizer: CalendarPerson[] =
    event.organizer &&
    (organizerEmail !== '' || textOrNull(event.organizer.name) !== null)
      ? [
          {
            name: textOrNull(event.organizer.name),
            email: organizerEmail,
            status: organizerAsParticipant
              ? participationStatusOf(organizerAsParticipant)
              : null,
            isOrganizer: true
          }
        ]
      : []
  const seen = new Set(organizerEmail ? [organizerEmail] : [])
  const attendees: CalendarPerson[] = []
  for (const participant of event.participants ?? []) {
    const email = addressOf(participant.mailto)
    const name = textOrNull(participant.name)
    if (!email && !name) continue
    if (email && seen.has(email)) continue
    if (email) seen.add(email)
    attendees.push({
      name,
      email,
      status: participationStatusOf(participant),
      isOrganizer: false
    })
  }
  return [...organizer, ...attendees]
}

/** The user is one of the participants of the event */
export function isParticipant(event: CalendarEvent, isSelf: IsSelf): boolean {
  return (event.participants ?? []).some(participant => {
    const email = addressOf(participant.mailto)
    return email !== '' && isSelf(email)
  })
}

/** The user organizes the event */
export function isOrganizer(event: CalendarEvent, isSelf: IsSelf): boolean {
  const email = addressOf(event.organizer?.mailto)
  return email !== '' && isSelf(email)
}

/** What the card offers to do */
export interface CalendarActions {
  /** Yes, Maybe, No: an invitation the user is part of */
  replies: readonly CalendarReply[]
  /** "Yes" accepts a counter proposal (`CalendarEventCounter/accept`) */
  acceptsCounter: boolean
  mailToAttendees: boolean
}

/**
 * tmail-flutter's rules: Yes, Maybe and No on a request the user is a
 * participant of; only Yes on a counter proposal; "Mail to attendees" as
 * soon as the event has an organizer or a participant. A cancellation and
 * an answer offer no reply.
 */
export function actionsOf(
  event: CalendarEvent,
  isSelf: IsSelf
): CalendarActions {
  const method = methodOf(event)
  const hasPeople =
    event.organizer !== null &&
    event.organizer !== undefined &&
    (event.participants ?? []).length > 0
  const canReply =
    (method === 'REQUEST' || method === 'ADD' || method === 'COUNTER') &&
    hasPeople &&
    isParticipant(event, isSelf)
  const mailToAttendees =
    Boolean(event.organizer) || (event.participants ?? []).length > 0
  if (!canReply) {
    return { replies: [], acceptsCounter: false, mailToAttendees }
  }
  if (method === 'COUNTER') {
    return { replies: [], acceptsCounter: true, mailToAttendees }
  }
  return {
    replies: ['yes', 'maybe', 'no'],
    acceptsCounter: false,
    mailToAttendees
  }
}

/** The organizer and the participants, without the user, deduplicated */
export function attendeeAddresses(
  event: CalendarEvent,
  isSelf: IsSelf
): string[] {
  const addresses = [
    addressOf(event.organizer?.mailto),
    ...(event.participants ?? []).map(participant =>
      addressOf(participant.mailto)
    )
  ].filter(address => address !== '' && !isSelf(address))
  return [...new Set(addresses)]
}

const VIDEO_CONFERENCE_FIELDS = [
  'X-OPENPAAS-VIDEOCONFERENCE',
  'X-GOOGLE-CONFERENCE'
] as const

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** The video conference links of the event (Twake, Google Meet) */
export function videoConferenceLinks(event: CalendarEvent): string[] {
  const fields = event.extensionFields ?? {}
  const links = VIDEO_CONFERENCE_FIELDS.flatMap(field => {
    const entry = Object.entries(fields).find(
      ([name]) => name.toUpperCase() === field
    )
    return entry?.[1] ?? []
  })
    .map(link => link.trim())
    .filter(isHttpUrl)
  return [...new Set(links)]
}

const VIDEO_CONFERENCE_SECTION = /-_-_-_-_-_-_-_-[\s\S]*?-_-_-_-_-_-_-_-/g

/**
 * The description as text: without the video conference section Twake
 * Calendar and Google add between `-_-_-_-…` markers, nor any HTML markup
 * (read as text, never rendered), its blank lines squeezed.
 */
export function descriptionText(
  description: string | null | undefined
): string {
  const withoutSection = (description ?? '').replace(
    VIDEO_CONFERENCE_SECTION,
    ''
  )
  const text = /<[a-z][^>]*>/i.test(withoutSection)
    ? new DOMParser().parseFromString(
        withoutSection.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n'),
        'text/html'
      ).body.textContent
    : withoutSection
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * The language of the reply emails tmail-backend writes: the UI language
 * when the server has it, else English, else the first it has; none when
 * the server lists none.
 */
export function replyLanguage(
  uiLanguage: string,
  supported: readonly string[] | null | undefined
): string | null {
  if (!supported || supported.length === 0) return null
  const code = uiLanguage.toLowerCase().split('-')[0] ?? ''
  if (supported.includes(code)) return code
  if (supported.includes('en')) return 'en'
  return supported[0] ?? null
}
