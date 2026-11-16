import type { Locator, Page } from '@playwright/test'

import { LoginPage, MailboxPage } from '../pages'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

/** Two pages of the list (30 emails each) */
const EMAIL_COUNT = 60

async function seedInbox(jmap: JmapClient, to: string): Promise<void> {
  const accountId = await jmap.accountId()
  const inbox = await jmap.findMailboxByRole('inbox')
  const create: Record<string, unknown> = {}
  for (let index = 0; index < EMAIL_COUNT; index += 1) {
    create[`m${index}`] = {
      mailboxIds: { [inbox.id]: true },
      keywords: { $seen: true },
      from: [{ name: 'Alice Martin', email: 'alice@example.com' }],
      to: [{ email: to }],
      subject: `Weekly report ${index}`,
      // Most recent first: report 0 on top
      receivedAt: new Date(Date.UTC(2025, 0, 1) - index * 3_600_000)
        .toISOString()
        .replace('.000', ''),
      textBody: [{ partId: 'text', type: 'text/plain' }],
      bodyValues: { text: { value: `Report ${index}` } }
    }
  }
  await jmap.request([['Email/set', { accountId, create }, 'set']])
}

async function scrollTopOf(list: Locator): Promise<number> {
  return list.evaluate(element => element.scrollTop)
}

/**
 * Lets the slide back to the list end: a click during it fails the hit test
 * of Playwright, which scrolls the row to other places to try again
 */
async function waitForTransitionEnd(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().length === 0)
}

test.describe('MBX-63 scroll position of the list', () => {
  test.use({ emailsOneByOne: true })

  test(
    'MBX-63 back from an email opened past the first page, the list is where it was',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await seedInbox(jmap, user.email)
      await jmap.waitForEmail({ subject: 'Weekly report 59' })
      await (await new LoginPage(page).goto()).loginAs(user)
      const mailbox = new MailboxPage(page)
      await mailbox.expectLoaded()
      const list = page.getByTestId('email-list')

      // Past the first page, which loads the second, the row opened off
      // the middle of the list (where the focus alone would bring it)
      await mailbox.scrollToEmail('Weekly report 45')
      await page.mouse.wheel(0, 150)
      await expect(mailbox.emailRow('Weekly report 44')).toBeInViewport()
      const scrollTop = await scrollTopOf(list)
      expect(scrollTop).toBeGreaterThan(0)

      // The back button of the browser
      await mailbox.openEmail('Weekly report 44')
      await page.goBack()
      await expect(mailbox.emailRow('Weekly report 44')).toBeInViewport()
      await expect.poll(() => scrollTopOf(list)).toBe(scrollTop)

      // The back button of the app
      await waitForTransitionEnd(page)
      const email = await mailbox.openEmail('Weekly report 44')
      await email.back()
      await expect(mailbox.emailRow('Weekly report 44')).toBeInViewport()
      await expect.poll(() => scrollTopOf(list)).toBe(scrollTop)
    }
  )
})
