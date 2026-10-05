import type { CalendarEvent } from 'jmap-client-ts/linagora'

import { makeIsSelf } from '@common/features/composer/replyRecipients'

import { findCalendarBlobIds, isUnnamedCalendarPart } from './calendarBlobs'
import {
  actionsOf,
  attendeeAddresses,
  bannerOf,
  peopleOf,
  replyLanguage,
  replyOfAttendance,
  videoConferenceLinks
} from './calendarEvent'
import { calendarEventUrl } from './calendarUrl'

const isSelf = makeIsSelf(['bob@example.com'])

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    uid: 'uid-1',
    title: 'Weekly sync',
    method: 'REQUEST',
    sequence: 0,
    organizer: { name: 'Olivia', mailto: 'olivia@example.com' },
    participants: [
      {
        name: 'Olivia',
        mailto: 'olivia@example.com',
        participationStatus: 'ACCEPTED'
      },
      {
        name: 'Bob',
        mailto: 'bob@example.com',
        participationStatus: 'NEEDS-ACTION'
      },
      {
        name: null,
        mailto: 'carol@example.com',
        participationStatus: 'declined'
      }
    ],
    ...overrides
  }
}

function part(
  type: string,
  blobId: string,
  name: string | null = null
): {
  type: string
  blobId: string
  name: string | null
  partId: null
  size: number
  headers: []
  charset: null
  disposition: null
  cid: null
  language: null
  location: null
  subParts: null
} {
  return {
    type,
    blobId,
    name,
    partId: null,
    size: 1,
    headers: [],
    charset: null,
    disposition: null,
    cid: null,
    language: null,
    location: null,
    subParts: null
  }
}

describe('calendar blobs', () => {
  it('prefers the .ics attachments, as tmail-flutter does', () => {
    expect(
      findCalendarBlobIds([
        part('text/calendar', 'b-inline'),
        part('application/ics', 'b-ics', 'invite.ics'),
        part('application/pdf', 'b-pdf', 'agenda.pdf')
      ])
    ).toEqual(['b-ics'])
  })

  it('falls back on the text/calendar parts', () => {
    expect(
      findCalendarBlobIds([
        part('text/calendar; method=REQUEST', 'b-inline'),
        part('application/pdf', 'b-pdf', 'agenda.pdf')
      ])
    ).toEqual(['b-inline'])
    expect(findCalendarBlobIds([part('image/png', 'b-png')])).toEqual([])
  })

  it('knows the nameless calendar part the card replaces', () => {
    expect(isUnnamedCalendarPart(part('text/calendar', 'b'))).toBe(true)
    expect(
      isUnnamedCalendarPart(part('text/calendar', 'b', 'meeting.ics'))
    ).toBe(false)
  })
})

describe('calendar event', () => {
  it('words the banner after the method', () => {
    expect(bannerOf(makeEvent(), [], 'An attendee')).toEqual({
      kind: 'invited',
      actor: 'Olivia'
    })
    expect(bannerOf(makeEvent({ sequence: 2 }), [], 'An attendee')).toEqual({
      kind: 'updated',
      actor: 'Olivia'
    })
    expect(bannerOf(makeEvent({ method: 'CANCEL' }), [], 'x')).toEqual({
      kind: 'canceled',
      actor: 'Olivia'
    })
    expect(
      bannerOf(
        makeEvent({ method: 'COUNTER' }),
        ['nobody@example.com'],
        'An attendee'
      )
    ).toEqual({ kind: 'counter', actor: 'An attendee' })
    expect(
      bannerOf(makeEvent({ method: 'REPLY' }), ['CAROL@example.com'], 'x')
    ).toEqual({ kind: 'declined', actor: 'carol@example.com' })
  })

  it('offers the answers to the participants of a request only', () => {
    expect(actionsOf(makeEvent(), isSelf)).toEqual({
      replies: ['yes', 'maybe', 'no'],
      acceptsCounter: false,
      mailToAttendees: true
    })
    expect(actionsOf(makeEvent({ method: 'COUNTER' }), isSelf)).toEqual({
      replies: [],
      acceptsCounter: true,
      mailToAttendees: true
    })
    expect(actionsOf(makeEvent({ method: 'CANCEL' }), isSelf).replies).toEqual(
      []
    )
    expect(
      actionsOf(makeEvent(), makeIsSelf(['stranger@example.com'])).replies
    ).toEqual([])
  })

  it('lists the organizer first, then the other participants', () => {
    expect(peopleOf(makeEvent())).toEqual([
      {
        name: 'Olivia',
        email: 'olivia@example.com',
        status: 'accepted',
        isOrganizer: true
      },
      {
        name: 'Bob',
        email: 'bob@example.com',
        status: 'needsAction',
        isOrganizer: false
      },
      {
        name: null,
        email: 'carol@example.com',
        status: 'declined',
        isOrganizer: false
      }
    ])
  })

  it('writes to everyone but the user', () => {
    expect(attendeeAddresses(makeEvent(), isSelf)).toEqual([
      'olivia@example.com',
      'carol@example.com'
    ])
  })

  it('reads the video conference links of Twake and Google', () => {
    expect(
      videoConferenceLinks(
        makeEvent({
          extensionFields: {
            'X-OPENPAAS-VIDEOCONFERENCE': ['https://meet.example.com/a'],
            'X-GOOGLE-CONFERENCE': ['https://meet.google.com/b', 'javascript:x']
          }
        })
      )
    ).toEqual(['https://meet.example.com/a', 'https://meet.google.com/b'])
  })

  it('maps the attendance to the answer it stands for', () => {
    expect(replyOfAttendance('accepted')).toBe('yes')
    expect(replyOfAttendance('tentativelyAccepted')).toBe('maybe')
    expect(replyOfAttendance('rejected')).toBe('no')
    expect(replyOfAttendance('needsAction')).toBe(null)
  })

  it('answers in the UI language when the server writes it', () => {
    expect(replyLanguage('fr', ['en', 'fr'])).toBe('fr')
    expect(replyLanguage('vi', ['fr', 'en'])).toBe('en')
    expect(replyLanguage('vi', ['fr'])).toBe('fr')
    expect(replyLanguage('fr', [])).toBe(null)
  })

  it('links the event in Twake Calendar', () => {
    expect(
      calendarEventUrl('uid/1', {
        calendarSpaUrl: 'https://calendar.{workplaceFqdn}/',
        workplaceFqdnFallback: '{localpart}.twake.example.com',
        username: 'bob@example.com'
      })
    ).toBe('https://calendar.bob.twake.example.com/events/uid%2F1')
    expect(
      calendarEventUrl('uid-1', {
        calendarSpaUrl: null,
        workplaceFqdnFallback: null,
        username: 'bob@example.com'
      })
    ).toBe(null)
  })
})
