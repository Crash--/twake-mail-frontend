import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { createInboxEmail } from '../scripts/seed-perf'
import {
  INSTRUMENT_SCRIPT,
  JmapRecorder,
  RUNS,
  heapUsedMb,
  login,
  readMarks,
  readPerfUser,
  report,
  resetMarks,
  waitInPage
} from './support'

/** Emails to load by scrolling, as asked by the measure */
const SCROLL_TARGET = Number(process.env.PERF_SCROLL_TARGET ?? 2000)
/** Pixels scrolled per animation frame: about 2 400 px/s at 60 fps, a fast continuous scroll */
const SCROLL_STEP = 40
const LIST_ROW = '[data-testid="email-list-item"]'

async function newPage(browser: Browser): Promise<{ context: BrowserContext; page: Page; jmap: JmapRecorder }> {
  const context = await browser.newContext()
  await context.addInitScript({ path: INSTRUMENT_SCRIPT })
  // One row per email, the reading view of one email: the measures of docs/perf (phase0.md,
  // sync.md) were taken so, before conversations became the default
  await context.addInitScript(() => {
    window.localStorage.setItem('twake-mail.preferences.thread', 'false')
  })
  const page = await context.newPage()
  return { context, page, jmap: new JmapRecorder(page) }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length
}

test.describe('PERF mailbox of 5 000 emails', () => {
  test('PERF-01 login, first page, push on one page, reading, folder switch', async ({ browser }) => {
    const user = readPerfUser()
    const m: Record<string, number[]> = {}
    const add = (name: string, value: number): void => {
      ;(m[name] ??= []).push(value)
    }

    for (let run = 0; run < RUNS; run += 1) {
      const { context, page, jmap } = await newPage(browser)

      // 1. Login, then the first row of the Inbox
      await login(page, user)
      await expect(page.locator(LIST_ROW).first()).toBeVisible()
      const marks = await readMarks(page)
      if (marks.firstRow === null || marks.lastClick === null) throw new Error('No first row mark')
      add('1. login click → first Inbox row (ms)', marks.firstRow - marks.lastClick)
      await jmap.idle(page)
      const firstQuery = jmap.calls.find(call => call.methods.includes('Email/query'))
      if (firstQuery === undefined) throw new Error('No Email/query')
      add('1. first Email/query+get request: duration (ms)', firstQuery.duration)
      add('1. first Email/query+get request: response (kB)', firstQuery.responseBytes / 1024)
      add('1. JMAP requests until the list is idle', jmap.calls.length)
      add('1. DOM rows rendered after the first page', await page.locator(LIST_ROW).count())

      // 5b. Push with one page loaded: a new email appears at the top
      const beforePush = jmap.calls.length
      const subject = `Pushed one page ${run} ${Date.now()}`
      const pushStart = await page.evaluate(() => performance.now())
      const shown = waitInPage(page, '[data-testid="email-list-item-subject"]', subject)
      await createInboxEmail(user, subject)
      add('5b. push, 1 page loaded: arrival → row shown (ms)', (await shown) - pushStart)
      await jmap.idle(page)
      const pushCalls = jmap.since(beforePush)
      add('5b. push, 1 page loaded: JMAP requests', pushCalls.length)
      add('5b. push, 1 page loaded: response bytes (kB)', sum(pushCalls.map(call => call.responseBytes)) / 1024)

      // 2. Open a read email (an unread one would be marked read: see the README quirks)
      const readRow = page.locator(`${LIST_ROW}:not([data-unread])`).nth(2)
      await resetMarks(page)
      await readRow.locator('[data-row-focus]').click()
      await expect(page.getByTestId('email-view-subject')).toBeVisible()
      await expect.poll(async () => (await readMarks(page)).bodyShown).not.toBeNull()
      const opened = await readMarks(page)
      if (opened.bodyShown === null || opened.lastClick === null) throw new Error('No body mark')
      add('2. click on a row → body frame loaded (ms)', opened.bodyShown - opened.lastClick)
      await jmap.idle(page)

      const backShown = waitInPage(page, `[data-mailbox-id="${user.inboxId}"] ${LIST_ROW}`)
      await page.getByTestId('email-view-back-button').click()
      const back = await backShown
      add('2. back to the list (cache) → first row (ms)', back - ((await readMarks(page)).lastClick ?? back))
      await jmap.idle(page)

      // 4. Inbox → other folder → Inbox
      const otherFolder = page.getByTestId('mailbox-item').filter({ hasText: 'Perf folder' })
      const otherShown = waitInPage(page, `[data-mailbox-id="${user.otherMailboxId}"] ${LIST_ROW}`)
      await otherFolder.locator('a').click()
      const other = await otherShown
      add('4. Inbox → other folder (first visit) → first row (ms)', other - ((await readMarks(page)).lastClick ?? other))
      await jmap.idle(page)

      const beforeReturn = jmap.calls.length
      const inboxShown = waitInPage(page, `[data-mailbox-id="${user.inboxId}"] ${LIST_ROW}`)
      await page.getByTestId('mailbox-item').and(page.locator('[data-mailbox-role="inbox"]')).locator('a').click()
      const inbox = await inboxShown
      add('4. other folder → Inbox (cached) → first row (ms)', inbox - ((await readMarks(page)).lastClick ?? inbox))
      await jmap.idle(page)
      add('4. other folder → Inbox: JMAP requests', jmap.since(beforeReturn).length)

      await context.close()
    }
    report(m)
  })

  test('PERF-02 continuous scroll to 2 000 emails, then a push', async ({ browser }) => {
    const user = readPerfUser()
    const m: Record<string, number[]> = {}
    const add = (name: string, value: number): void => {
      ;(m[name] ??= []).push(value)
    }

    for (let run = 0; run < RUNS; run += 1) {
      const { context, page, jmap } = await newPage(browser)
      const cdp = await context.newCDPSession(page)
      await login(page, user)
      await expect(page.locator(LIST_ROW).first()).toBeVisible()
      await jmap.idle(page)
      const heapBefore = await heapUsedMb(cdp)
      const beforeScroll = jmap.calls.length

      // 3. Scroll continuously, one step per animation frame, until 2 000 emails are loaded
      const scroll = await page.evaluate(
        ([target, step, rowSelector]) =>
          new Promise<{ frames: number[]; maxRows: number; maxIndex: number; start: number; end: number }>(resolve => {
            const scroller = document.querySelector('[data-testid="email-list"]')
            if (!(scroller instanceof HTMLElement)) throw new Error('No list')
            const frames: number[] = []
            let maxRows = 0
            let maxIndex = 0
            const start = performance.now()
            let last = start
            const tick = (now: number): void => {
              frames.push(now - last)
              last = now
              scroller.scrollTop += step
              const rows = document.querySelectorAll(rowSelector)
              maxRows = Math.max(maxRows, rows.length)
              for (const row of Array.from(rows)) {
                maxIndex = Math.max(maxIndex, Number(row.getAttribute('data-index') ?? 0))
              }
              if (maxIndex >= target - 1 || now - start > 600_000) {
                resolve({ frames, maxRows, maxIndex, start, end: now })
              } else {
                requestAnimationFrame(tick)
              }
            }
            requestAnimationFrame(tick)
          }),
        [SCROLL_TARGET, SCROLL_STEP, LIST_ROW] as const
      )
      await jmap.idle(page)
      const marks = await readMarks(page)
      const pages = jmap.since(beforeScroll).filter(call => call.methods.includes('Email/query'))
      const longTasks = marks.longTasks.filter(([start]) => start >= scroll.start && start <= scroll.end)
      add('3. scroll to 2 000 emails: duration (s)', (scroll.end - scroll.start) / 1000)
      add('3. pagination requests', pages.length)
      add('3. mean duration of a page request (ms)', mean(pages.map(call => call.duration)))
      add('3. mean response of a page (kB)', mean(pages.map(call => call.responseBytes)) / 1024)
      add('3. max DOM rows rendered while scrolling', scroll.maxRows)
      add('3. long tasks (> 50 ms)', longTasks.length)
      add('3. total long task time (ms)', sum(longTasks.map(([, duration]) => duration)))
      add('3. frames longer than 50 ms', scroll.frames.filter(frame => frame > 50).length)
      add('3. frames (total)', scroll.frames.length)
      add('3. p99 frame (ms)', [...scroll.frames].sort((a, b) => a - b)[Math.floor(scroll.frames.length * 0.99)] ?? 0)
      add('3. JS heap after GC, before scroll (MB)', heapBefore)
      add('3. JS heap after GC, 2 000 loaded (MB)', await heapUsedMb(cdp))

      // 5. Push with 2 000 emails loaded. The new row is far above the viewport, hence not
      // rendered: the list announces new emails in its live region once they are in its data
      const beforePush = jmap.calls.length
      const subject = `Pushed 2000 ${run} ${Date.now()}`
      const pushStart = await page.evaluate(() => performance.now())
      const grown = waitInPage(page, '[role="status"]', 'You have new messages')
      await createInboxEmail(user, subject)
      add('5. push, 2 000 loaded: arrival → list updated (ms)', (await grown) - pushStart)
      await jmap.idle(page)
      const pushCalls = jmap.since(beforePush)
      add('5. push, 2 000 loaded: JMAP requests', pushCalls.length)
      add('5. push, 2 000 loaded: response bytes (kB)', sum(pushCalls.map(call => call.responseBytes)) / 1024)
      add('5. push, 2 000 loaded: request bytes (kB)', sum(pushCalls.map(call => call.requestBytes)) / 1024)
      const pushLongTasks = (await readMarks(page)).longTasks.filter(([start]) => start >= pushStart)
      add('5. push, 2 000 loaded: long tasks', pushLongTasks.length)
      add('5. push, 2 000 loaded: long task time (ms)', sum(pushLongTasks.map(([, duration]) => duration)))
      add('5. JS heap after GC, after the push (MB)', await heapUsedMb(cdp))

      await context.close()
    }
    report(m)
  })
})
