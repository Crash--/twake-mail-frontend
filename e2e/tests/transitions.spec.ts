import type { Page } from '@playwright/test'

import { EmailPage, LoginPage, MailboxPage, SearchPage } from '../pages'
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

interface ComposerLayerProbe {
  __composerLayers?: { name: string; groupWidth: string }[]
}

/**
 * For each view transition the page starts: the `view-transition-name` of
 * the composer window and the width of its `::view-transition-group`, which
 * only exists when the window is a layer of its own (not in the root one).
 */
async function watchComposerLayers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const view: Window & ComposerLayerProbe = window
    view.__composerLayers = []
    if (typeof document.startViewTransition !== 'function') return
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = (
      ...args: Parameters<Document['startViewTransition']>
    ): ViewTransition => {
      const transition = start(...args)
      transition.ready
        .then(() => {
          const window = document.querySelector('[data-testid="composer"]')
          const name = window
            ? getComputedStyle(window).getPropertyValue('view-transition-name')
            : 'none'
          const groupWidth = getComputedStyle(
            document.documentElement,
            `::view-transition-group(${name})`
          ).width
          view.__composerLayers?.push({ name, groupWidth })
        })
        .catch(() => undefined)
      return transition
    }
  })
}

test.describe('EML composer kept while navigating', () => {
  test.use({ emailsOneByOne: true })

  test('EML-37 a composer open while emails open and close is not part of the page transition, and is not remounted (issue #93)', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    for (const index of [0, 1]) {
      await jmapFor(sender).sendEmail({
        to: user.email,
        subject: `Slide ${index}`,
        text: `Body of slide ${index}`
      })
    }
    await jmap.waitForEmail({ subject: 'Slide 1' })
    await watchViewTransitions(page)
    await watchComposerLayers(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    test.skip(
      !(await hasViewTransitionApi(page)),
      'a browser without the View Transitions API: EML-33'
    )

    const composer = await mailbox.compose()
    await composer.editor.click()
    await page.keyboard.type('hello')
    const editorNode = await composer.editor.elementHandle()
    const sameEditor = (): Promise<boolean> =>
      composer.editor.evaluate(
        (node, expected) => node === expected,
        editorNode
      )

    // The dock covers the middle of the row: the link is clicked at its start
    const openSlide = async (subject: string): Promise<EmailPage> => {
      await mailbox
        .emailRowLink(subject)
        .click({ position: { x: 5, y: 5 } })
      const email = new EmailPage(page)
      await email.expectSubject(subject)
      return email
    }

    const before = await viewTransitionCount(page)
    const first = await openSlide('Slide 0')
    await first.back()
    await openSlide('Slide 1')
    await expect(composer.editor).toHaveText('hello')
    expect(await sameEditor()).toBe(true)
    expect(await viewTransitionCount(page)).toBe(before + 3)

    // Each transition had the composer as a layer of its own
    await expect
      .poll(async () =>
        page.evaluate(
          () => (window as Window & ComposerLayerProbe).__composerLayers
        )
      )
      .toHaveLength(3)
    const layers = await page.evaluate(
      () => (window as Window & ComposerLayerProbe).__composerLayers ?? []
    )
    for (const layer of layers) {
      expect(layer.name).toMatch(/^composer-/)
      expect(layer.groupWidth).not.toBe('')
      expect(layer.groupWidth).not.toBe('auto')
    }

    // The same editor still takes the typing
    await composer.editor.click()
    await page.keyboard.type('!')
    await expect(composer.editor).toHaveText('hello!')
    await expect(composer.editor).toBeFocused()
    expect(await sameEditor()).toBe(true)
  })
})
