import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { CalendarEventCard, LoginPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'

/**
 * Calendar invitations (iMIP): the card tmail-backend parses from the
 * `.ics` of an email (`CalendarEvent/parse`), its answers and "Mail to
 * attendees". The fixtures name `bob@example.com` as attendee, replaced by
 * the test user on import.
 *
 * Answering (`CalendarEvent/accept`, `maybe`, `reject`,
 * `CalendarEventCounter/accept`) and reading the answer back
 * (`CalendarEventAttendance/get`) go through the CalDAV server of a Twake
 * Workplace (esn-sabre): the stack runs a fake of it, docker/fake-dav.mjs,
 * reachable on /e2e/caldav/ to put an event in a calendar first.
 */

const COUNTER_EML = 'calendar/calendar_counter_web.eml'
const REQUEST_EML = 'calendar/calendar_request.eml'
const CANCEL_EML = 'calendar/calendar_cancel.eml'
/** The event of the organizer that the counter proposal of COUNTER_EML changes */
const COUNTER_ORIGINAL_ICS = 'calendar/calendar_counter_original.ics'
const COUNTER_UID = 'a0b97e6e-3c82-4ef1-9837-56c168959f3d'
const REQUEST_UID = 'twake-e2e-weekly-sync'

/** A fixture of e2e/fixtures/eml, `bob@example.com` replaced by `email` */
async function readFixture(file: string, email: string): Promise<string> {
  const text = await readFile(
    path.join(__dirname, '../fixtures/eml', file),
    'utf8'
  )
  return text.replaceAll('bob@example.com', email)
}

/**
 * Puts an event in the calendar of `email` on the fake CalDAV server, as
 * esn-sabre does when an invitation arrives
 */
async function putCalendarEvent(
  email: string,
  uid: string,
  ics: string
): Promise<void> {
  const calendar = `${env.baseUrl}/e2e/caldav/calendars/${email}/${email}`
  const response = await fetch(`${calendar}/${uid}.ics`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/calendar' },
    body: ics
  })
  if (!response.ok) {
    throw new Error(`PUT of event ${uid} on the fake CalDAV: ${response.status}`)
  }
}

test.describe('CAL calendar events', () => {
  test.describe('reading one email at a time', () => {
    test.use({ emailsOneByOne: true })

    test('CAL-01 a counter proposal found by search shows its card with Yes and Mail to attendees only', async ({
      page,
      user,
      jmap
    }) => {
      await jmap.importEml(COUNTER_EML, 'inbox', {
        replace: { 'bob@example.com': user.email }
      })
      await expect
        .poll(
          async () =>
            (await jmap.queryEmails({ text: 'Proposed new time' })).length
        )
        .toBe(1)

      await new LoginPage(page).loginAs(user)
      const search = await new SearchPage(page).search('Proposed new time')
      await search.openResult('Proposed new time')

      const card = await new CalendarEventCard(page).expectVisible(
        'Come for a chat'
      )
      await expect(card.banner).toContainText(
        'has proposed changes to the event'
      )
      await expect(card.answerButton('yes')).toBeVisible()
      await expect(card.mailToAttendeesButton).toBeVisible()
      await expect(card.answerButton('no')).toBeHidden()
      await expect(card.answerButton('maybe')).toBeHidden()
      await expectNoA11yViolations(page)
    })

    test('CAL-02 "Mail to attendees" of a counter proposal writes to the others, subject "Re: <title>"', async ({
      page,
      user,
      jmap
    }) => {
      await jmap.importEml(COUNTER_EML, 'inbox', {
        replace: { 'bob@example.com': user.email }
      })

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.openEmail('Proposed new time')
      const card = await new CalendarEventCard(page).expectVisible(
        'Come for a chat'
      )
      const composer = await card.mailToAttendees()

      await expect(composer.subjectInput).toHaveValue('Re: Come for a chat')
      await expect(composer.recipients('to')).toHaveText([
        'tddang@linagora.com'
      ])
    })

    test(
      'CAL-03 an invitation shows when, how it repeats, where, the video conference, who answered what and the description',
      { tag: '@mobile' },
      async ({ page, user, jmap }) => {
        await jmap.importEml(REQUEST_EML, 'inbox', {
          replace: { 'bob@example.com': user.email }
        })

        const mailbox = await new LoginPage(page).loginAs(user)
        await mailbox.openEmail('Invitation: Weekly sync')
        const card = await new CalendarEventCard(page).expectVisible(
          'Weekly sync'
        )

        await expect(card.banner).toHaveText(
          'Olivia Organizer has invited you to a meeting'
        )
        // Europe/Paris, the time zone of the browser (playwright.config.ts)
        await expect(card.when).toContainText(
          /Monday, October 12, 2026 · 10:00\s–\s11:00\sAM/
        )
        await expect(card.recurrence).toContainText(
          'Every 2 weeks, on Monday, 5 times'
        )
        await expect(card.where).toContainText('Room 42, Building B')
        await expect(card.videoLink).toHaveAttribute(
          'href',
          'https://meet.example.com/weekly-sync'
        )
        // Shown and copied, not joined (tmail-flutter #4622)
        await expect(card.videoLink).toHaveText(
          'https://meet.example.com/weekly-sync'
        )
        await expect(card.copyLinkButton).toBeVisible()
        // Everyone, the organizer first: the list folds past six people
        await expect(card.people).toHaveText([
          'Olivia Organizer <olivia@example.com> - Organizer',
          `Bob <${user.email}> · awaiting reply`,
          'Alice <alice@example.com> · accepted',
          'Carol <carol@example.com> · declined',
          'Dave <dave@example.com> · maybe'
        ])
        await expect(card.seeAllAttendeesButton).toBeHidden()
        // After the card, read as text: the markup of the file is not rendered
        await expect(card.description).toContainText('Agenda: roadmap')
        await expect(card.description.locator('b')).toHaveCount(0)
        for (const answer of ['yes', 'maybe', 'no'] as const) {
          await expect(card.answerButton(answer)).toHaveAttribute(
            'aria-pressed',
            'false'
          )
        }
        await expect(card.openInCalendarLink).toHaveAttribute(
          'href',
          'https://calendar.example.com/events/twake-e2e-weekly-sync'
        )
        await expectNoA11yViolations(page)
      }
    )

    test('CAL-04 a cancellation says so and offers no answer', async ({
      page,
      user,
      jmap
    }) => {
      await jmap.importEml(CANCEL_EML, 'inbox', {
        replace: { 'bob@example.com': user.email }
      })

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.openEmail('Canceled: Weekly sync')
      const card = await new CalendarEventCard(page).expectVisible(
        'Weekly sync'
      )

      await expect(card.banner).toHaveText(
        'Olivia Organizer has canceled a meeting'
      )
      await expect(card.replies).toBeHidden()
      await expect(card.mailToAttendeesButton).toBeVisible()
      await expectNoA11yViolations(page)
    })

    test('CAL-05 an invitation sent to someone else warns the user', async ({
      page,
      user,
      jmap
    }) => {
      await jmap.importEml(REQUEST_EML, 'inbox')

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.openEmail('Invitation: Weekly sync')
      const card = await new CalendarEventCard(page).expectVisible(
        'Weekly sync'
      )

      await expect(card.notInvited).toContainText(
        'You are not invited to this event.'
      )
      await expect(card.replies).toBeHidden()
      await expect(card.openInCalendarLink).toBeHidden()
    })

    test('CAL-06 Yes, Maybe and No answer the invitation, the answer kept after a reload', async ({
      page,
      user,
      jmap
    }) => {
      const request = await readFixture(REQUEST_EML, user.email)
      const invitation = /BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR\r?\n/.exec(
        request
      )?.[0]
      if (invitation === undefined) throw new Error(`${REQUEST_EML}: no .ics`)
      await putCalendarEvent(user.email, REQUEST_UID, invitation)
      await jmap.importEml(REQUEST_EML, 'inbox', {
        replace: { 'bob@example.com': user.email }
      })

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.openEmail('Invitation: Weekly sync')
      const card = await new CalendarEventCard(page).expectVisible(
        'Weekly sync'
      )
      await card.answer('maybe')

      await expect(page.getByTestId('toast')).toHaveText(
        /You may attend this meeting/
      )
      await expect(card.answerButton('maybe')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      // Basic credentials live in memory: sign in again, back on the email
      await page.reload()
      await new LoginPage(page).loginAfterReload(user)
      await expect(card.answerButton('maybe')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })

    test('CAL-07 Yes on a counter proposal accepts the proposed time', async ({
      page,
      user,
      jmap
    }) => {
      await putCalendarEvent(
        user.email,
        COUNTER_UID,
        await readFixture(COUNTER_ORIGINAL_ICS, user.email)
      )
      await jmap.importEml(COUNTER_EML, 'inbox', {
        replace: { 'bob@example.com': user.email }
      })

      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.openEmail('Proposed new time')
      const card = await new CalendarEventCard(page).expectVisible(
        'Come for a chat'
      )
      await card.answer('yes')

      await expect(page.getByTestId('toast')).toHaveText(
        /You accepted the proposed time for this meeting/
      )
    })
  })
})
