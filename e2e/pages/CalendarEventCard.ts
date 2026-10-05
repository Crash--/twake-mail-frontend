import { expect, type Locator, type Page } from '@playwright/test'

import { ComposerPage } from './ComposerPage'

export type CalendarAnswer = 'yes' | 'maybe' | 'no'

/**
 * The event card of an email holding an invitation (iMIP), above its body.
 * Patrol counterpart: the calendar part of robots/email_robot.dart.
 */
export class CalendarEventCard {
  readonly page: Page
  readonly root: Locator
  readonly banner: Locator
  readonly title: Locator
  readonly when: Locator
  readonly recurrence: Locator
  readonly where: Locator
  readonly videoLink: Locator
  readonly copyLinkButton: Locator
  readonly people: Locator
  readonly seeAllAttendeesButton: Locator
  readonly description: Locator
  readonly replies: Locator
  readonly mailToAttendeesButton: Locator
  readonly openInCalendarLink: Locator
  readonly notInvited: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('calendar-event-card')
    this.banner = this.root.getByTestId('calendar-event-banner')
    this.title = this.root.getByRole('heading').first()
    this.when = this.root.getByTestId('calendar-event-when')
    this.recurrence = this.root.getByTestId('calendar-event-recurrence')
    this.where = this.root.getByTestId('calendar-event-where')
    this.videoLink = this.root.getByTestId('calendar-event-video-link')
    this.copyLinkButton = this.root.getByTestId('calendar-event-copy-link')
    this.people = this.root.getByTestId('calendar-event-person')
    this.seeAllAttendeesButton = this.root.getByTestId(
      'calendar-event-see-all-attendees'
    )
    // After the card, with the body of the email
    this.description = page.getByTestId('calendar-event-description')
    this.replies = this.root.getByTestId('calendar-event-replies')
    this.mailToAttendeesButton = this.root.getByTestId(
      'calendar-event-mail-to-attendees'
    )
    this.openInCalendarLink = this.root.getByTestId(
      'calendar-event-open-in-calendar'
    )
    this.notInvited = this.root.getByTestId('calendar-event-not-invited')
  }

  answerButton(answer: CalendarAnswer): Locator {
    return this.root.getByTestId(`calendar-event-reply-${answer}`)
  }

  async expectVisible(title: string): Promise<CalendarEventCard> {
    await expect(this.root).toBeVisible()
    await expect(this.title).toHaveText(title)
    return this
  }

  async answer(answer: CalendarAnswer): Promise<CalendarEventCard> {
    await this.answerButton(answer).click()
    return this
  }

  async mailToAttendees(): Promise<ComposerPage> {
    await this.mailToAttendeesButton.click()
    const composer = new ComposerPage(this.page)
    await expect(composer.root).toBeVisible()
    return composer
  }
}
