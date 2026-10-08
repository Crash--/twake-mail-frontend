import type { Frame, Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import { openAccountMenuIfAny } from '../support/accountMenu'

const EMAIL_COUNT = 40
const SUBJECT = 'Scroll check 27'
const EMBED_HOST = '/embed-host'

/** A page that frames the app, as Twake Workplace does */
const EMBED_HOST_HTML = `<!doctype html>
<html><body style="margin:0"><iframe src="/" title="Twake Mail" style="display:block;border:0;width:100vw;height:100vh"></iframe></body></html>`

/** More emails than a screen shows, so that the list itself scrolls */
async function seedInbox(jmap: JmapClient, to: string): Promise<void> {
  const accountId = await jmap.accountId()
  const inbox = await jmap.findMailboxByRole('inbox')
  const create: Record<string, unknown> = {}
  for (let index = 0; index < EMAIL_COUNT; index += 1) {
    create[`m${index}`] = {
      mailboxIds: { [inbox.id]: true },
      keywords: {},
      from: [{ name: `Sender ${index}`, email: 'sender@example.com' }],
      to: [{ email: to }],
      subject: `Scroll check ${index}`,
      receivedAt: `2024-12-${String((index % 28) + 1).padStart(2, '0')}T10:${String(index).padStart(2, '0')}:00Z`,
      textBody: [{ partId: 'text', type: 'text/plain' }],
      bodyValues: { text: { value: `Message ${index}` } }
    }
  }
  await jmap.request([['Email/set', { accountId, create }, 'set']])
}

/** How far the document overflows the viewport, and what overflows it */
async function documentOverflow(scope: Page | Frame): Promise<{
  overflow: number
  culprits: string[]
}> {
  return scope.evaluate(() => {
    const root = document.scrollingElement
    if (root === null) return { overflow: 0, culprits: [] }
    const bottom = window.innerHeight
    const culprits: string[] = []
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      if (element.getBoundingClientRect().bottom <= bottom + 0.01) continue
      let isClipped = false
      for (
        let ancestor: Element | null = element;
        ancestor !== null && ancestor !== document.body;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor)
        if (
          style.position === 'fixed' ||
          (ancestor !== element && style.overflowY !== 'visible')
        ) {
          isClipped = true
          break
        }
      }
      if (!isClipped) {
        const id =
          element.getAttribute('data-testid') ?? element.getAttribute('role')
        culprits.push(
          `${element.tagName.toLowerCase()}[${id ?? ''}].${element.className}`
        )
      }
    }
    return { overflow: root.scrollHeight - root.clientHeight, culprits }
  })
}

async function expectNoPageScroll(scope: Page | Frame): Promise<void> {
  expect(await documentOverflow(scope)).toEqual({ overflow: 0, culprits: [] })
}

const SCREENS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'small desktop', viewport: { width: 1280, height: 720 } },
  { name: 'tablet', viewport: { width: 820, height: 1180 } }
]

test.describe('LAYOUT page scroll', () => {
  // The reading view of a single email: the "Thread" setting off
  test.use({ emailsOneByOne: true })

  for (const screen of SCREENS) {
    for (const mode of ['standalone', 'embedded'] as const) {
      test.describe(`${mode}, ${screen.name}`, () => {
        test.use({ viewport: screen.viewport })

        test(`LAYOUT-01 the document does not scroll on the mailbox, the reading view and the settings (${mode}, ${screen.name})`, async ({
          page,
          user,
          jmap
        }) => {
          test.skip(
            test.info().project.name !== 'chromium',
            'sized by the test itself'
          )
          await seedInbox(jmap, user.email)
          await jmap.waitForEmail({ subject: SUBJECT })
          // The suite serves the Workplace configuration: the standalone
          // layout needs it off, the embedded one is framed below
          await page.route('**/.env.js', async route => {
            const response = await route.fetch()
            const body = (await response.text()).replace(
              /var WORKPLACE_EMBEDDING = \w+/,
              `var WORKPLACE_EMBEDDING = ${mode === 'embedded'}`
            )
            await route.fulfill({ response, body })
          })

          let scope: Page | Frame = page
          if (mode === 'embedded') {
            // The credentials live in the memory of the app: log in in the frame
            await page.route(`**${EMBED_HOST}`, route =>
              route.fulfill({ contentType: 'text/html', body: EMBED_HOST_HTML })
            )
            await page.goto(EMBED_HOST)
            const frame = await (
              await page.locator('iframe').elementHandle()
            )?.contentFrame()
            if (frame === null || frame === undefined) {
              throw new Error('The app did not load in the frame')
            }
            scope = frame
            await scope.getByTestId('login-username-input').fill(user.email)
            await scope.getByTestId('login-password-input').fill(user.password)
            await scope.getByTestId('login-submit-button').click()
          } else {
            await (await new LoginPage(page).goto()).loginAs(user)
          }

          const row = scope
            .getByTestId('email-list-item')
            .filter({ hasText: SUBJECT })
          await expect(row).toBeVisible()
          // The page and the list are the same document
          await expectNoPageScroll(scope)
          // The list scrolls inside its own container
          const list = scope.getByTestId('email-list')
          expect(
            await list.evaluate(el => el.scrollHeight > el.clientHeight)
          ).toBe(true)

          await row.click()
          await expect(scope.getByTestId('email-view-subject')).toHaveText(
            SUBJECT
          )
          await expectNoPageScroll(scope)

          await openAccountMenuIfAny(scope)
          await scope.getByTestId('settings-button').click()
          await expect(scope.getByRole('heading', { level: 1 })).toBeVisible()
          await expectNoPageScroll(scope)
        })
      })
    }
  }
})
