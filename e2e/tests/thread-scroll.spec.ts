import type { Page } from '@playwright/test'

import { ConversationPage, LoginPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import { hasViewTransitionApi } from '../support/viewTransitions'

const SUBJECT = 'Long conversation'
const MESSAGE_COUNT = 24
const NEEDLE = 'needlexyz'
/** Pixels the target may move while the bodies above it grow */
const MAX_CORRECTION = 16

interface ThreadOptions {
  /** 1-based number of the first unread message, none when absent */
  firstUnread?: number
  /** 1-based number of the message holding NEEDLE */
  needleIn?: number
}

/**
 * A conversation of MESSAGE_COUNT messages in the inbox, the oldest first,
 * each a reply to the previous one. Returns the ids, oldest first.
 */
async function createLongThread(
  jmap: JmapClient,
  from: string,
  to: string,
  options: ThreadOptions = {}
): Promise<string[]> {
  const accountId = await jmap.accountId()
  const inbox = await jmap.findMailboxByRole('inbox')
  const ids: string[] = []
  // One at a time: the server threads an email by the ones it knows
  for (let number = 1; number <= MESSAGE_COUNT; number += 1) {
    const isFirstUnread = number === options.firstUnread
    const previous = `long-${number - 1}@example.com`
    const day = String(number).padStart(2, '0')
    const responses = await jmap.request([
      [
        'Email/set',
        {
          accountId,
          create: {
            m: {
              mailboxIds: { [inbox.id]: true },
              keywords: isFirstUnread ? {} : { $seen: true },
              from: [{ name: `Sender ${number}`, email: from }],
              to: [{ email: to }],
              subject: number === 1 ? SUBJECT : `Re: ${SUBJECT}`,
              receivedAt: `2024-12-${day}T10:00:00Z`,
              messageId: [`long-${number}@example.com`],
              ...(number === 1
                ? {}
                : {
                    inReplyTo: [previous],
                    references: [previous]
                  }),
              textBody: [{ partId: 'text', type: 'text/plain' }],
              bodyValues: {
                text: {
                  value: `Message number ${number}${number === options.needleIn ? ` ${NEEDLE}` : ''}`
                }
              }
            }
          }
        },
        'set'
      ]
    ])
    const created = responses[0]?.[1].created
    const id =
      typeof created === 'object' && created !== null && 'm' in created
        ? (created.m as { id?: unknown }).id
        : null
    if (typeof id !== 'string') throw new Error(`Message ${number} not created`)
    ids.push(id)
  }
  return ids
}

/** Records how the page scrolls things into view */
async function recordScrolls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: unknown[] = []
    Object.defineProperty(window, '__scrolls', { value: calls })
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoView(
      this: Element,
      arg?: boolean | ScrollIntoViewOptions
    ): void {
      calls.push(arg)
      original.call(this, arg)
    }
  })
}

/** Opens the long conversation from the list, returns how it scrolled */
async function openAndReadScrolls(
  page: Page,
  user: Parameters<LoginPage['loginAs']>[0]
): Promise<(string | undefined)[]> {
  await recordScrolls(page)
  const mailbox = await new LoginPage(page).loginAs(user)
  await mailbox.emailRowLink(`Re: ${SUBJECT}`).click()
  const conversation = await new ConversationPage(page).expectLoaded(
    `Re: ${SUBJECT}`
  )
  await expect(
    conversation.toggle(conversation.message(/Sender 24/))
  ).toBeFocused()
  return page.evaluate(() =>
    (window as unknown as { __scrolls: { behavior?: string }[] }).__scrolls.map(
      options => options.behavior
    )
  )
}

/**
 * What the page showed while a conversation opened with a view transition:
 * the scroll position of the reading area at every frame the conversation was
 * on screen, and the one at the end of the transition.
 */
interface OpeningTrace {
  transitions: number
  frames: number[]
  atFinish: number | null
  scrolledAfterFinish: boolean
}

interface TraceWindow {
  __opening: OpeningTrace
}

async function traceOpening(page: Page): Promise<void> {
  await page.addInitScript((maxCorrection: number) => {
    const trace: OpeningTrace = {
      transitions: 0,
      frames: [],
      atFinish: null,
      scrolledAfterFinish: false
    }
    Object.defineProperty(window, '__opening', { value: trace })
    // The scrolling area of the conversation: the pane on desktops, the main
    // content below
    const top = (): number => {
      let element = document.querySelector('[data-testid="conversation-view"]')
      while (
        element !== null &&
        !/(auto|scroll)/.test(getComputedStyle(element).overflowY)
      ) {
        element = element.parentElement
      }
      return Math.round(element?.scrollTop ?? 0)
    }
    const start = document.startViewTransition?.bind(document)
    if (start) {
      document.startViewTransition = (
        ...args: Parameters<Document['startViewTransition']>
      ): ViewTransition => {
        trace.transitions += 1
        const transition = start(...args)
        void transition.finished.then(() => {
          trace.atFinish = top()
        })
        return transition
      }
    }
    document.addEventListener(
      'scroll',
      () => {
        if (
          trace.atFinish !== null &&
          Math.abs(top() - trace.atFinish) > maxCorrection
        ) {
          trace.scrolledAfterFinish = true
        }
      },
      true
    )
    const onFrame = (): void => {
      if (document.querySelector('[data-testid="conversation-view"]')) {
        trace.frames.push(top())
      }
      requestAnimationFrame(onFrame)
    }
    requestAnimationFrame(onFrame)
  }, MAX_CORRECTION)
}

/**
 * The conversation opened with a view transition shows its target from its
 * first frame to the end of the transition (one motion, no scroll under it),
 * and the transition ends on the final scroll position.
 */
async function expectCleanOpening(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as TraceWindow).__opening.atFinish
        ),
      { message: 'the view transition finishes' }
    )
    .not.toBeNull()
  // Room for the late corrections (bodies growing) and for a late scroll
  await page.waitForTimeout(1000)
  const trace = await page.evaluate(
    () => (window as unknown as TraceWindow).__opening
  )
  expect(trace.transitions).toBeGreaterThan(0)
  const finalTop = trace.atFinish ?? Number.NaN
  expect(finalTop).toBeGreaterThan(0)
  // From the first frame of the conversation: never on its top first, only
  // the small corrections of the bodies growing above the target
  expect(trace.frames.length).toBeGreaterThan(0)
  for (const top of trace.frames) {
    expect(Math.abs(top - finalTop)).toBeLessThanOrEqual(MAX_CORRECTION)
  }
  expect(trace.scrolledAfterFinish).toBe(false)
}

test.describe('THR conversation opens on the message to read', () => {
  test(
    'THR-11 from the list, on the first unread message, focused and in view',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await createLongThread(jmap, 'emma@example.com', user.email, {
        firstUnread: 18
      })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.emailRowLink(`Re: ${SUBJECT}`).click()

      const conversation = await new ConversationPage(page).expectLoaded(
        `Re: ${SUBJECT}`
      )
      await expect(conversation.messages).toHaveCount(MESSAGE_COUNT)
      const target = conversation.message(/Sender 18/)
      await expect(conversation.toggle(target)).toBeFocused()
      await expect(conversation.toggle(target)).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      await expect(conversation.toggle(target)).toBeInViewport()
      await expect(
        conversation.toggle(conversation.messages.first())
      ).not.toBeInViewport()
      // The subject and count are read with the header
      await expect(conversation.toggle(target)).toHaveAccessibleDescription(
        new RegExp(`Re: ${SUBJECT}.*${MESSAGE_COUNT} messages`)
      )

      // Under the sticky bar of the conversation, not behind it
      const toolbar = page.getByTestId('conversation-toolbar')
      await expect(toolbar).toBeInViewport()
      const bar = await toolbar.boundingBox()
      const header = await conversation.toggle(target).boundingBox()
      expect(header?.y).toBeGreaterThanOrEqual(
        (bar?.y ?? 0) + (bar?.height ?? 0) - 1
      )
      await expectNoA11yViolations(page)
    }
  )

  test('THR-12 from the list, on the latest message when all are read', async ({
    page,
    user,
    jmap
  }) => {
    await createLongThread(jmap, 'emma@example.com', user.email)
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.emailRowLink(`Re: ${SUBJECT}`).click()

    const conversation = await new ConversationPage(page).expectLoaded(
      `Re: ${SUBJECT}`
    )
    const latest = conversation.message(/Sender 24/)
    await expect(conversation.toggle(latest)).toBeFocused()
    await expect(conversation.toggle(latest)).toBeInViewport()
    await expect(
      conversation.toggle(conversation.messages.first())
    ).not.toBeInViewport()
  })

  test(
    'THR-13 from a search result, on the message that matched',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await createLongThread(jmap, 'emma@example.com', user.email, {
        needleIn: 14
      })
      await new LoginPage(page).loginAs(user)
      const search = await new SearchPage(page).search(NEEDLE)
      await search.resultRows().first().click()

      const conversation = await new ConversationPage(page).expectLoaded(
        `Re: ${SUBJECT}`
      )
      const target = conversation.message(/Sender 14/)
      await expect(conversation.toggle(target)).toBeFocused()
      await expect(conversation.toggle(target)).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      await expect(conversation.toggle(target)).toBeInViewport()
      await expect(
        conversation.toggle(conversation.messages.first())
      ).not.toBeInViewport()
    }
  )

  test(
    'THR-14 from a link to an email, on that message',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const ids = await createLongThread(jmap, 'emma@example.com', user.email)
      const inbox = await jmap.findMailboxByRole('inbox')
      // The link, signed out: the session is in memory only
      await page.goto(`/mailbox/${inbox.id}/email/${ids[14]}`)
      const login = new LoginPage(page)
      await login.usernameInput.fill(user.email)
      await login.passwordInput.fill(user.password)
      await login.submitButton.click()
      const conversation = await new ConversationPage(page).expectLoaded(
        `Re: ${SUBJECT}`
      )
      const target = conversation.message(/Sender 15/)
      await expect(conversation.toggle(target)).toBeFocused()
      await expect(conversation.toggle(target)).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      await expect(conversation.toggle(target)).toBeInViewport()
      await expect(
        conversation.toggle(conversation.messages.first())
      ).not.toBeInViewport()
    }
  )

  test('THR-15 scrolls at once, never smoothly', async ({
    page,
    user,
    jmap
  }) => {
    await createLongThread(jmap, 'emma@example.com', user.email)
    const behaviors = await openAndReadScrolls(page, user)
    expect(behaviors.length).toBeGreaterThan(0)
    expect(behaviors).not.toContain('smooth')
  })

  test(
    'THR-18 from the list, the view transition ends on the final scroll position',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await createLongThread(jmap, 'emma@example.com', user.email, {
        firstUnread: 18
      })
      await traceOpening(page)
      const mailbox = await new LoginPage(page).loginAs(user)
      test.skip(
        !(await hasViewTransitionApi(page)),
        'a browser without the View Transitions API'
      )
      await mailbox.emailRowLink(`Re: ${SUBJECT}`).click()
      const conversation = await new ConversationPage(page).expectLoaded(
        `Re: ${SUBJECT}`
      )
      await expect(
        conversation.toggle(conversation.message(/Sender 18/))
      ).toBeInViewport()

      await expectCleanOpening(page)
    }
  )

  test(
    'THR-19 from a search result, the view transition ends on the final scroll position',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await createLongThread(jmap, 'emma@example.com', user.email, {
        needleIn: 14
      })
      await traceOpening(page)
      await new LoginPage(page).loginAs(user)
      test.skip(
        !(await hasViewTransitionApi(page)),
        'a browser without the View Transitions API'
      )
      const search = await new SearchPage(page).search(NEEDLE)
      await search.resultRows().first().click()
      const conversation = await new ConversationPage(page).expectLoaded(
        `Re: ${SUBJECT}`
      )
      await expect(
        conversation.toggle(conversation.message(/Sender 14/))
      ).toBeInViewport()

      await expectCleanOpening(page)
    }
  )

  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } })

    test('THR-16 scrolls without animation', async ({ page, user, jmap }) => {
      await createLongThread(jmap, 'emma@example.com', user.email)
      const behaviors = await openAndReadScrolls(page, user)
      expect(behaviors.length).toBeGreaterThan(0)
      expect(behaviors).not.toContain('smooth')
    })
  })

  test(
    'THR-17 expanding, collapsing and a reply arriving do not move the view',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await createLongThread(jmap, 'emma@example.com', user.email, {
        firstUnread: 18
      })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.emailRowLink(`Re: ${SUBJECT}`).click()
      const conversation = await new ConversationPage(page).expectLoaded(
        `Re: ${SUBJECT}`
      )
      const target = conversation.toggle(conversation.message(/Sender 18/))
      await expect(target).toBeFocused()
      // Past the time the opening keeps the target in place
      await page.waitForTimeout(2000)
      const top = async (): Promise<number> =>
        Math.round((await target.boundingBox())?.y ?? Number.NaN)

      // A message below it
      const below = conversation.toggle(conversation.message(/Sender 21/))
      await below.scrollIntoViewIfNeeded()
      const belowTop = Math.round((await below.boundingBox())?.y ?? 0)
      await below.click()
      await expect(below).toHaveAttribute('aria-expanded', 'true')
      expect(Math.round((await below.boundingBox())?.y ?? 0)).toBe(belowTop)
      await below.click()
      await expect(below).toHaveAttribute('aria-expanded', 'false')
      expect(Math.round((await below.boundingBox())?.y ?? 0)).toBe(belowTop)

      // A reply arriving by push
      await target.scrollIntoViewIfNeeded()
      const beforeReply = await top()
      const accountId = await jmap.accountId()
      const inbox = await jmap.findMailboxByRole('inbox')
      await jmap.request([
        [
          'Email/set',
          {
            accountId,
            create: {
              reply: {
                mailboxIds: { [inbox.id]: true },
                keywords: { $seen: true },
                from: [{ name: 'Late sender', email: 'late@example.com' }],
                to: [{ email: user.email }],
                subject: `Re: ${SUBJECT}`,
                receivedAt: '2024-12-30T10:00:00Z',
                'header:In-Reply-To:asMessageIds': ['long-24@example.com'],
                'header:References:asMessageIds': ['long-24@example.com'],
                textBody: [{ partId: 'text', type: 'text/plain' }],
                bodyValues: { text: { value: 'A reply arriving by push' } }
              }
            }
          },
          'reply'
        ]
      ])
      await expect(conversation.messages).toHaveCount(MESSAGE_COUNT + 1)
      expect(await top()).toBe(beforeReply)
    }
  )
})
