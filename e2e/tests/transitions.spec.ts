import { LoginPage, MailboxPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import {
  hasViewTransitionApi,
  removeViewTransitionApi,
  viewTransitionCount,
  watchViewTransitions
} from '../support/viewTransitions'

/** Enough emails for the list to scroll on every screen */
const EMAIL_COUNT = 16

/** Emails from another account: one copy each, in the Inbox */
async function seedEmails(
  sender: JmapClient,
  jmap: JmapClient,
  to: string
): Promise<void> {
  for (let index = 0; index < EMAIL_COUNT; index++) {
    await sender.sendEmail({
      to,
      subject: `Slide ${index}`,
      text: `Body of slide ${index}`
    })
  }
  await jmap.waitForEmail({ subject: `Slide ${EMAIL_COUNT - 1}` })
}

/**
 * Opens the oldest email (scrolled to the bottom of the list) and goes back:
 * the subject takes the focus, then the row again, still on screen. Returns
 * the view transitions the page started.
 */
async function openAndClose(
  mailbox: MailboxPage,
  page: MailboxPage['page']
): Promise<number> {
  const subject = 'Slide 0'
  const row = await mailbox.scrollToEmail(subject)
  const before = await viewTransitionCount(page)

  const email = await mailbox.openEmail(subject)
  await expect(email.subject).toBeFocused()
  await expectNoA11yViolations(page)

  await email.back()
  await expect(mailbox.emailRowLink(subject)).toBeFocused()
  await expect(row).toBeInViewport()
  return (await viewTransitionCount(page)) - before
}

test.describe('EML opening an email with a view transition', () => {
  // The reading view of a single email: the "Thread" setting off
  test.use({ emailsOneByOne: true })

  test(
    'EML-32 opening and closing an email slides, the focus and the scroll kept',
    { tag: '@mobile' },
    async ({ page, user, users, jmap, jmapFor }) => {
      const sender = await users.create({ prefix: 'sender' })
      await seedEmails(jmapFor(sender), jmap, user.email)
      await watchViewTransitions(page)
      const mailbox = await new LoginPage(page).loginAs(user)
      test.skip(
        !(await hasViewTransitionApi(page)),
        'a browser without the View Transitions API: EML-33'
      )

      expect(await openAndClose(mailbox, page)).toBe(2)

      // From the search results too
      const search = await new SearchPage(page).search('Slide')
      const before = await viewTransitionCount(page)
      const email = await search.openResult('Slide 3')
      await expect(email.subject).toBeFocused()
      expect(await viewTransitionCount(page)).toBe(before + 1)
    }
  )

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test(
      'EML-33 with reduced motion, an email opens and closes at once',
      { tag: '@mobile' },
      async ({ page, user, users, jmap, jmapFor }) => {
        const sender = await users.create({ prefix: 'sender' })
        await seedEmails(jmapFor(sender), jmap, user.email)
        await watchViewTransitions(page)
        const mailbox = await new LoginPage(page).loginAs(user)

        expect(await openAndClose(mailbox, page)).toBe(0)
      }
    )
  })

  test('EML-33 without the View Transitions API, an email opens and closes at once', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    await seedEmails(jmapFor(sender), jmap, user.email)
    await removeViewTransitionApi(page)
    await watchViewTransitions(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    expect(await hasViewTransitionApi(page)).toBe(false)

    expect(await openAndClose(mailbox, page)).toBe(0)
  })
})
