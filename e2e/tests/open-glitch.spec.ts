import type { Frame, Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

const SUBJECT = 'Glitch conversation'
const MESSAGE_COUNT = 4
const EMBED_HOST = '/embed-host'
/** The app framed as Twake Workplace does */
const EMBED_HOST_HTML = `<!doctype html>
<html><body style="margin:0"><iframe src="/" title="Twake Mail" style="display:block;border:0;width:100vw;height:100vh"></iframe></body></html>`
/** Pixels the reading pane may move while the conversation opens */
const MAX_MOVE = 1

/** A newsletter-like HTML body, long enough for the iframe to grow a lot */
function newsletter(number: number): string {
  const paragraphs = Array.from(
    { length: 40 },
    (_, index) =>
      `<p style="margin:0 0 12px;font-family:Georgia,serif;color:#333">Message ${number}, paragraph ${index}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>`
  ).join('')
  return `<html><head><style>.hero{background:#0a3d62;color:#fff;padding:24px;font-family:Arial}</style></head><body><div class="hero"><h1 style="margin:0">Newsletter ${number}</h1></div>${paragraphs}</body></html>`
}

/** A conversation of HTML emails in the inbox, all read, and 12 other emails */
async function seedConversation(jmap: JmapClient, to: string): Promise<void> {
  const accountId = await jmap.accountId()
  const inbox = await jmap.findMailboxByRole('inbox')
  const create = async (
    key: string,
    subject: string,
    day: number,
    number: number,
    previous: string | null
  ): Promise<void> => {
    await jmap.request([
      [
        'Email/set',
        {
          accountId,
          create: {
            [key]: {
              mailboxIds: { [inbox.id]: true },
              keywords: { $seen: true },
              from: [{ name: 'News', email: 'news@example.com' }],
              to: [{ email: to }],
              subject,
              receivedAt: `2024-12-${String(day).padStart(2, '0')}T10:00:00Z`,
              messageId: [`glitch-${number}@example.com`],
              ...(previous === null
                ? {}
                : { inReplyTo: [previous], references: [previous] }),
              htmlBody: [{ partId: 'html', type: 'text/html' }],
              bodyValues: { html: { value: newsletter(number) } }
            }
          }
        },
        'set'
      ]
    ])
  }
  for (let index = 0; index < 12; index += 1) {
    await create(`o${index}`, `Other ${index}`, index + 1, 100 + index, null)
  }
  for (let number = 1; number <= MESSAGE_COUNT; number += 1) {
    await create(
      `m${number}`,
      number === 1 ? SUBJECT : `Re: ${SUBJECT}`,
      20 + number,
      number,
      number === 1 ? null : `glitch-${number - 1}@example.com`
    )
  }
  await jmap.waitForEmail({ subject: `Re: ${SUBJECT}` })
}

interface OpeningFrame {
  isLoading: boolean
  isTransitioning: boolean
  /** Top of the element the view transition snapshots, null when none */
  paneTop: number | null
  hasConversation: boolean
  /** Scroll position of the reading area */
  scroll: number
}

interface OpeningTrace {
  frames: OpeningFrame[]
  transitions: number
  /** Scroll position of the reading area when the transition finished */
  atFinish: number | null
}

interface TraceWindow {
  __glitch: OpeningTrace
}

/** Records, at every frame, what the page shows of the reading view */
async function traceFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const trace: OpeningTrace = { frames: [], transitions: 0, atFinish: null }
    Object.defineProperty(window, '__glitch', { value: trace })
    const find = (id: string): Element | null =>
      document.querySelector(`[data-testid="${id}"]`)
    // The scrolling ancestor of the reading view
    const scroller = (): Element | null => {
      let element = find('conversation-view')
      while (
        element !== null &&
        !/(auto|scroll)/.test(getComputedStyle(element).overflowY)
      ) {
        element = element.parentElement
      }
      return element
    }
    const pane = (): Element | null => {
      let element = find('conversation-view')
      while (
        element !== null &&
        !/^list-detail-/.test(getComputedStyle(element).viewTransitionName)
      ) {
        element = element.parentElement
      }
      return element
    }
    const start = document.startViewTransition?.bind(document)
    if (start) {
      document.startViewTransition = (
        ...args: Parameters<Document['startViewTransition']>
      ): ViewTransition => {
        trace.transitions += 1
        const transition = start(...args)
        void transition.finished.then(() => {
          trace.atFinish = Math.round(scroller()?.scrollTop ?? 0)
        })
        return transition
      }
    }
    const onFrame = (): void => {
      trace.frames.push({
        isLoading: find('email-view-loading') !== null,
        isTransitioning: document.documentElement.matches(
          ':active-view-transition'
        ),
        paneTop: pane()?.getBoundingClientRect().top ?? null,
        hasConversation: find('conversation-view') !== null,
        scroll: Math.round(scroller()?.scrollTop ?? 0)
      })
      requestAnimationFrame(onFrame)
    }
    requestAnimationFrame(onFrame)
  })
}

async function readTrace(scope: Page | Frame): Promise<OpeningTrace> {
  return scope.evaluate(() => (window as unknown as TraceWindow).__glitch)
}

const SCREENS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'small desktop', viewport: { width: 1280, height: 800 } },
  { name: 'side by side', viewport: { width: 1000, height: 800 } }
]
/** Delay added to every JMAP call: a remote server, like the demo */
const LATENCIES = [0, 100]

test.describe('THR-20 opening a conversation with a view transition', () => {
  for (const screen of SCREENS) {
    for (const mode of ['standalone', 'embedded'] as const) {
      for (const latency of LATENCIES) {
        test.describe(`${mode}, ${screen.name}, ${latency} ms`, () => {
          test.use({ viewport: screen.viewport })

          test(`THR-20 the transition ends on the conversation, with no skeleton and no moving pane (${mode}, ${screen.name}, ${latency} ms)`, async ({
            page,
            user,
            jmap
          }) => {
            test.skip(
              test.info().project.name !== 'chromium',
              'sized by the test itself'
            )
            await seedConversation(jmap, user.email)
            await traceFrames(page)
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
              await page.route(`**${EMBED_HOST}`, route =>
                route.fulfill({
                  contentType: 'text/html',
                  body: EMBED_HOST_HTML
                })
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
              await scope
                .getByTestId('login-password-input')
                .fill(user.password)
              await scope.getByTestId('login-submit-button').click()
            } else {
              await new LoginPage(page).loginAs(user)
            }
            const row = scope
              .getByTestId('email-list-item')
              .filter({ hasText: SUBJECT })
            await expect(row).toBeVisible()
            if (latency > 0) {
              await page.route('**/jmap**', async route => {
                await new Promise(resolve => setTimeout(resolve, latency))
                await route.continue()
              })
            }

            await row.click()
            await expect(scope.getByTestId('conversation-subject')).toHaveText(
              `Re: ${SUBJECT}`
            )
            await expect
              .poll(async () => (await readTrace(scope)).atFinish, {
                message: 'the view transition finishes'
              })
              .not.toBeNull()
            // Room for the bodies to load and the target to settle
            await page.waitForTimeout(800)
            const trace = await readTrace(scope)

            expect(trace.transitions, 'a view transition ran').toBe(1)
            const inTransition = trace.frames.filter(f => f.isTransitioning)
            expect(inTransition.length).toBeGreaterThan(0)

            // The transition never animates towards a skeleton
            expect(
              trace.frames.filter(f => f.isLoading && f.isTransitioning),
              'frames with the skeleton during the transition'
            ).toEqual([])
            expect(
              trace.frames.filter(f => f.isLoading),
              'frames with the skeleton'
            ).toEqual([])

            // The pane the transition snapshots stays where it is, whatever
            // the scroll of the conversation: otherwise the snapshot slides
            // over the search row and the top bar
            const tops = trace.frames
              .filter(f => f.hasConversation && f.paneTop !== null)
              .map(f => f.paneTop ?? 0)
            expect(tops.length).toBeGreaterThan(0)
            expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(
              MAX_MOVE
            )

            // It ends on the final position, and nothing scrolls after
            const afterFinish = trace.frames
              .slice(trace.frames.findLastIndex(f => f.isTransitioning) + 1)
              .map(f => f.scroll)
            expect(afterFinish.length).toBeGreaterThan(0)
            for (const scroll of afterFinish) {
              expect(
                Math.abs(scroll - (trace.atFinish ?? 0))
              ).toBeLessThanOrEqual(MAX_MOVE)
            }
            // The target is the latest message: the reading area is scrolled
            expect(trace.atFinish).toBeGreaterThan(0)
          })
        })
      }
    }
  }
})
