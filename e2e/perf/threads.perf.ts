import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { createInboxEmail, createInboxReply } from '../scripts/seed-perf'
import { INSTRUMENT_SCRIPT, JmapRecorder, RUNS, login, readPerfUser, report, waitInPage } from './support'

/** Conversations to load by scrolling before the push */
const SCROLL_TARGET = Number(process.env.PERF_SCROLL_TARGET ?? 2000)
const SCROLL_STEP = 40
const LIST_ROW = '[data-testid="email-list-item"]'
/** Emails of the seeded Inbox replied to: within the loaded rows, and far below them */
const LOADED_INDEX = 1000
const OLDER_INDEX = 4000

async function newPage(browser: Browser): Promise<{ context: BrowserContext; page: Page; jmap: JmapRecorder }> {
  const context = await browser.newContext()
  await context.addInitScript({ path: INSTRUMENT_SCRIPT })
  // Conversations on, whatever the default of the build
  await context.addInitScript(() => {
    window.localStorage.setItem('twake-mail.preferences.thread', 'true')
  })
  const page = await context.newPage()
  return { context, page, jmap: new JmapRecorder(page) }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** Scrolls the list, one step per frame, until `target` rows are loaded */
async function scrollTo(page: Page, target: number): Promise<void> {
  await page.evaluate(
    ([wanted, step, rowSelector]) =>
      new Promise<void>(resolve => {
        const scroller = document.querySelector('[data-testid="email-list"]')
        if (!(scroller instanceof HTMLElement)) throw new Error('No list')
        const start = performance.now()
        const tick = (now: number): void => {
          scroller.scrollTop += step
          const indexes = Array.from(document.querySelectorAll(rowSelector)).map(row =>
            Number(row.getAttribute('data-index') ?? 0)
          )
          if (Math.max(0, ...indexes) >= wanted - 1 || now - start > 600_000) resolve()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    [target, SCROLL_STEP, LIST_ROW] as const
  )
}

/** Rows the list holds (loaded), read from the height of its scroller */
async function loadedRows(page: Page): Promise<number> {
  return page.evaluate(rowSelector => {
    const scroller = document.querySelector('[data-testid="email-list"]')
    const row = document.querySelector(rowSelector)
    if (!(scroller instanceof HTMLElement) || !(row instanceof HTMLElement)) return 0
    return Math.round(scroller.scrollHeight / row.getBoundingClientRect().height)
  }, LIST_ROW)
}

/**
 * Push on a list of conversations with 2 000 of them loaded (issue #11), on a perf user seeded
 * with `PERF_THREADS=1`: a reply to a loaded conversation and one to a conversation far below
 * the loaded rows, which come up to the top, and an email starting a new conversation. Each in a
 * fresh page.
 */
test.describe('PERF conversations', () => {
  for (const kind of ['reply to a loaded conversation', 'reply to an older conversation', 'new conversation'] as const) {
    test(`PERF-04 push with ${SCROLL_TARGET} conversations loaded: ${kind}`, async ({ browser }) => {
      const user = readPerfUser()
      const m: Record<string, number[]> = {}
      const add = (name: string, value: number): void => {
        ;(m[`4. ${kind}: ${name}`] ??= []).push(value)
      }
      for (let run = 0; run < RUNS; run += 1) {
        const { context, page, jmap } = await newPage(browser)
        await login(page, user)
        await expect(page.locator(LIST_ROW).first()).toBeVisible()
        await jmap.idle(page)
        await scrollTo(page, SCROLL_TARGET)
        await jmap.idle(page)
        add('rows loaded before the push', await loadedRows(page))

        const beforePush = jmap.calls.length
        const subject = `Pushed ${kind} ${run} ${Date.now()}`
        const pushStart = await page.evaluate(() => performance.now())
        const shown = waitInPage(page, '[role="status"]', 'You have new messages')
        if (kind === 'new conversation') await createInboxEmail(user, subject)
        else await createInboxReply(user, kind === 'reply to a loaded conversation' ? LOADED_INDEX : OLDER_INDEX)
        add('arrival → list updated (ms)', (await shown) - pushStart)
        await jmap.idle(page)
        const calls = jmap.since(beforePush)
        add('JMAP requests', calls.length)
        add('Email/query calls', calls.filter(call => call.methods.includes('Email/query')).length)
        add('response bytes (kB)', sum(calls.map(call => call.responseBytes)) / 1024)
        add('rows loaded after the push', await loadedRows(page))
        await context.close()
      }
      report(m)
    })
  }
})
