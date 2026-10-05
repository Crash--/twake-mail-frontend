import type { Page } from '@playwright/test'

import { ConversationPage, LoginPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

const SUBJECT = 'Long conversation'
const MESSAGE_COUNT = 24
const NEEDLE = 'needlexyz'

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
    (
      window as unknown as { __scrolls: { behavior?: string }[] }
    ).__scrolls.map(options => options.behavior)
  )
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

  test('THR-15 scrolls smoothly', async ({ page, user, jmap }) => {
    await createLongThread(jmap, 'emma@example.com', user.email)
    expect(await openAndReadScrolls(page, user)).toContain('smooth')
  })

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
