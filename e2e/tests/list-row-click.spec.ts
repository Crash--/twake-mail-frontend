import type { Locator, Page } from '@playwright/test'

import { EmailPage, LoginPage, MailboxPage } from '../pages'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

/** More rows than one screen holds, all on the first page */
const EMAIL_COUNT = 30

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
      subject: `Row click ${index}`,
      receivedAt: new Date(Date.UTC(2025, 0, 1) - index * 3_600_000)
        .toISOString()
        .replace('.000', ''),
      textBody: [{ partId: 'text', type: 'text/plain' }],
      bodyValues: { text: { value: `Row ${index}` } }
    }
  }
  await jmap.request([['Email/set', { accountId, create }, 'set']])
}

/** A real click on the sender of a row, where the pointer lands, not on its link */
async function clickSender(page: Page, row: Locator): Promise<void> {
  const box = await row.getByTestId('email-list-item-sender').boundingBox()
  if (box === null) throw new Error('the row has no sender in view')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

test.describe('LST-14 a click on a row opens its email', () => {
  test.use({ emailsOneByOne: true })

  test('LST-14 where table rows cannot be positioned (Safari before 26), a click on a row opens that row, at the top and one screen down', async ({
    page,
    user,
    jmap
  }) => {
    await seedInbox(jmap, user.email)
    await jmap.waitForEmail({ subject: `Row click ${EMAIL_COUNT - 1}` })
    await (await new LoginPage(page).goto()).loginAs(user)
    const mailbox = new MailboxPage(page)
    await mailbox.expectLoaded()
    // What Safari 18 does: `position: relative` on a `tr` is ignored
    await page.addStyleTag({
      content: 'tr { position: static !important; }'
    })
    const list = page.getByTestId('email-list')
    const email = new EmailPage(page)

    await clickSender(page, mailbox.emailRow('Row click 0'))
    await email.expectSubject('Row click 0')
    await email.back()
    await expect(mailbox.emailRow('Row click 0')).toBeInViewport()
    expect(await list.evaluate(element => element.scrollTop)).toBe(0)

    await mailbox.scrollToEmail('Row click 25')
    await clickSender(page, mailbox.emailRow('Row click 25'))
    await email.expectSubject('Row click 25')
  })
})
