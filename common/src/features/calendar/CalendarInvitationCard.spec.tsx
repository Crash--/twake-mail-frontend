import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CalendarEvent } from 'jmap-client-ts/linagora'
import { Route } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'
import {
  makeBodyPart,
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import { renderWithProviders } from '@common/testing/renderWithProviders'

const CALENDAR = 'com:linagora:params:calendar:event'

const INVITATION: CalendarEvent = {
  uid: 'weekly-sync',
  title: 'Weekly sync',
  description:
    'Agenda: <b>roadmap</b>\n-_-_-_-_-_-_-_-\nJoin: https://meet.example.com/x\n-_-_-_-_-_-_-_-\nNotes at https://docs.example.com/sync',
  utcStart: '2026-10-12T08:00:00Z',
  utcEnd: '2026-10-12T09:00:00Z',
  location: 'Room 42',
  method: 'REQUEST',
  sequence: 0,
  organizer: { name: 'Olivia', mailto: 'olivia@example.com' },
  participants: [
    {
      name: 'Alice',
      mailto: 'alice@example.com',
      participationStatus: 'NEEDS-ACTION'
    },
    {
      name: 'Carol',
      mailto: 'carol@example.com',
      participationStatus: 'ACCEPTED'
    }
  ],
  extensionFields: {
    'X-OPENPAAS-VIDEOCONFERENCE': ['https://meet.example.com/weekly-sync']
  },
  recurrenceRules: [
    { frequency: 'weekly', interval: 2, byDay: ['mo'], count: 5 }
  ]
}

function makeServer(
  event: CalendarEvent,
  {
    capability = { replySupportedLanguage: ['en', 'fr'], counterSupport: true },
    attendance = 'needsAction'
  }: {
    capability?: Record<string, unknown> | null
    attendance?: string | null
  } = {}
): FakeJmapServer {
  const server = makeFakeJmapServer({
    emails: [
      makeEmailWithBody(
        {
          id: 'e1',
          subject: 'Invitation: Weekly sync',
          from: [{ name: 'Olivia', email: 'olivia@example.com' }],
          hasAttachment: true,
          attachments: [
            makeBodyPart({
              partId: '3',
              blobId: 'b-cal',
              type: 'text/calendar'
            }),
            makeBodyPart({
              partId: '4',
              blobId: 'b-ics',
              type: 'application/ics',
              name: 'invite.ics'
            })
          ]
        },
        { text: 'You are invited' }
      )
    ],
    capabilities: capability === null ? {} : { [CALENDAR]: capability }
  })
  server.handlers.set('CalendarEvent/parse', args => ({
    accountId: args.accountId,
    parsed: { 'b-ics': [event] }
  }))
  server.handlers.set('CalendarEventAttendance/get', args =>
    attendance === null
      ? { error: 'serverFail' }
      : {
          accountId: args.accountId,
          list: [
            { blobId: 'b-ics', eventAttendanceStatus: attendance, isFree: true }
          ]
        }
  )
  return server
}

function renderView(server: FakeJmapServer): void {
  renderWithProviders(
    <EmailView emailId="e1" backPath="/mailbox/mailbox-inbox" />,
    {
      route: '/mailbox/mailbox-inbox/email/e1',
      path: '/mailbox/:mailboxId/email/:emailId',
      withJmapSession: true,
      jmapServer: server,
      routes: <Route path="/mailbox/:mailboxId" element={<p>The list</p>} />
    }
  )
}

describe('CalendarInvitationCard', () => {
  listEmailsOneByOne()

  it('shows the event of the .ics attachment', async () => {
    const server = makeServer({
      ...INVITATION,
      participants: [
        ...(INVITATION.participants ?? []),
        { name: 'Alice', mailto: 'alice@example.com' },
        {
          name: 'Dave',
          mailto: 'dave@example.com',
          participationStatus: 'TENTATIVE'
        },
        ...['erin', 'frank', 'grace', 'heidi'].map(name => ({
          name: null,
          mailto: `${name}@example.com`
        }))
      ]
    })
    renderView(server)

    const card = await screen.findByRole('region', {
      name: 'Event: Weekly sync'
    })
    expect(within(card).getByTestId('calendar-event-banner')).toHaveTextContent(
      'Olivia has invited you to a meeting'
    )
    expect(
      within(card).getByRole('heading', { name: 'Weekly sync' })
    ).toBeVisible()
    expect(
      within(card).getByTestId('calendar-event-recurrence')
    ).toHaveTextContent('Every 2 weeks, on Monday, 5 times')
    expect(within(card).getByTestId('calendar-event-where')).toHaveTextContent(
      'Room 42'
    )
    // Shown and copied, not joined (tmail-flutter #4622)
    expect(
      within(card).getByRole('link', {
        name: 'https://meet.example.com/weekly-sync'
      })
    ).toHaveAttribute('href', 'https://meet.example.com/weekly-sync')
    expect(
      within(card).getByRole('button', { name: 'Copy link' })
    ).toBeVisible()
    // After the card, as text, without the video conference section
    const description = screen.getByTestId('calendar-event-description')
    expect(description).toHaveTextContent(
      'Agenda: roadmapNotes at https://docs.example.com/sync'
    )
    expect(description.querySelector('b')).toBe(null)
    expect(
      within(description).getByRole('link', {
        name: 'https://docs.example.com/sync'
      })
    ).toHaveAttribute('target', '_blank')
    // The organizer, then the first attendees with their answer
    const people = within(card).getAllByTestId('calendar-event-person')
    expect(people.map(person => person.textContent)).toEqual([
      'Olivia <olivia@example.com> - Organizer',
      'Alice <alice@example.com> · awaiting reply',
      'Carol <carol@example.com> · accepted',
      'Dave <dave@example.com> · maybe',
      'erin@example.com'
    ])
    await userEvent.click(
      within(card).getByRole('button', { name: 'See all attendees (8)' })
    )
    expect(within(card).getAllByTestId('calendar-event-person')).toHaveLength(8)
    expect(within(card).getByRole('button', { name: 'Hide' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(server.callsOf('CalendarEvent/parse')).toEqual([
      { accountId: 'account-alice', blobIds: ['b-ics'] }
    ])
    // The nameless calendar part is the card; the named file stays listed
    expect(screen.getByText(/invite\.ics/)).toBeVisible()
    expect(screen.getAllByTestId('attachment-item')).toHaveLength(1)
  })

  it('answers Yes in the UI language and shows the answer', async () => {
    const server = makeServer(INVITATION)
    server.handlers.set('CalendarEvent/accept', args => ({
      accountId: args.accountId,
      accepted: ['weekly-sync']
    }))
    renderView(server)

    const yes = await screen.findByRole('button', { name: 'Yes' })
    expect(yes).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('group', { name: 'Attending?' })).toBeVisible()
    await userEvent.click(yes)

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You will attend this meeting'
    )
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(server.callsOf('CalendarEvent/accept')).toEqual([
      { accountId: 'account-alice', blobIds: ['b-ics'], language: 'en' }
    ])
  })

  it('says why an answer failed and keeps the previous one', async () => {
    const server = makeServer(INVITATION, { attendance: 'tentativelyAccepted' })
    server.handlers.set('CalendarEvent/reject', args => ({
      accountId: args.accountId,
      notRejected: {
        'b-ics': { type: 'serverFail', description: 'No CalDAV' }
      }
    }))
    renderView(server)

    expect(
      await screen.findByRole('button', { name: 'Maybe' })
    ).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'No' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      '[serverFail] No CalDAV'
    )
    expect(screen.getByRole('button', { name: 'Maybe' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('offers only Yes on a counter proposal, which accepts it', async () => {
    const server = makeServer({ ...INVITATION, method: 'COUNTER' })
    server.handlers.set('CalendarEventCounter/accept', args => ({
      accountId: args.accountId,
      accepted: ['b-ics']
    }))
    renderView(server)

    expect(
      await screen.findByTestId('calendar-event-banner')
    ).toHaveTextContent('An attendee has proposed changes to the event')
    expect(screen.queryByRole('button', { name: 'No' })).toBe(null)
    expect(screen.queryByRole('button', { name: 'Maybe' })).toBe(null)
    expect(
      screen.getByRole('button', { name: 'Mail to attendees' })
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You accepted the proposed time for this meeting'
    )
    expect(server.callsOf('CalendarEventCounter/accept')).toEqual([
      { accountId: 'account-alice', blobIds: ['b-ics'] }
    ])
  })

  it('shows the card when the server cannot tell the answer', async () => {
    renderView(makeServer(INVITATION, { attendance: null }))

    expect(await screen.findByRole('button', { name: 'Yes' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('offers no answer on a cancellation', async () => {
    renderView(makeServer({ ...INVITATION, method: 'CANCEL' }))

    expect(
      await screen.findByTestId('calendar-event-banner')
    ).toHaveTextContent('Olivia has canceled a meeting')
    expect(screen.queryByRole('group', { name: 'Attending?' })).toBe(null)
    expect(
      screen.getByRole('button', { name: 'Mail to attendees' })
    ).toBeVisible()
  })

  it('warns a user who is not invited', async () => {
    renderView(
      makeServer({
        ...INVITATION,
        participants: [{ name: 'Carol', mailto: 'carol@example.com' }]
      })
    )

    expect(
      await screen.findByTestId('calendar-event-not-invited')
    ).toHaveTextContent('You are not invited to this event.')
    expect(screen.queryByRole('group', { name: 'Attending?' })).toBe(null)
  })

  it('reads no event without the capability', async () => {
    const server = makeServer(INVITATION, { capability: null })
    renderView(server)

    expect(await screen.findByTestId('email-view-subject')).toBeVisible()
    await waitFor(() => {
      expect(server.calledMethods()).toContain('Email/get')
    })
    expect(screen.queryByTestId('calendar-event-card')).toBe(null)
    expect(server.callsOf('CalendarEvent/parse')).toEqual([])
  })
})
