import { test, type Page, type Request } from '@playwright/test'

import { RUNS, heapUsedMb, readPerfUser, report } from './support'

/**
 * Reference: measures 1 and 3 on tmail-flutter web against the same stack, for comparison.
 * Skipped unless PERF_FLUTTER_URL points at a tmail-web served with
 * SERVER_URL=<the e2e stack origin> (see e2e/README.md, "Performance").
 *
 * Flutter web paints on a canvas: the first row is detected in its semantics tree (enabled
 * through its `flt-semantics-placeholder`), which adds some work of its own. The login form is
 * driven by clicks at fixed coordinates (1440x900 window, tmail-web 0.30).
 */
const FLUTTER_URL = process.env.PERF_FLUTTER_URL ?? ''
const SCROLL_TARGET = Number(process.env.PERF_SCROLL_TARGET ?? 2000)

/** Ids returned by the Email/query calls of the page */
class QueryCounter {
  ids = 0
  queries = 0
  durations: number[] = []
  bytes: number[] = []

  constructor(page: Page) {
    page.on('requestfinished', (request: Request) => {
      void this.#record(request)
    })
  }

  async #record(request: Request): Promise<void> {
    if (request.method() !== 'POST' || !request.url().endsWith('/jmap')) return
    if (!(request.postData() ?? '').includes('"Email/query"')) return
    const response = await request.response()
    if (response === null) return
    const body = await response.body()
    const parsed: unknown = JSON.parse(body.toString('utf8'))
    const responses =
      typeof parsed === 'object' && parsed !== null && 'methodResponses' in parsed && Array.isArray(parsed.methodResponses)
        ? parsed.methodResponses
        : []
    for (const invocation of responses) {
      if (Array.isArray(invocation) && invocation[0] === 'Email/query') {
        const args: unknown = invocation[1]
        if (typeof args === 'object' && args !== null && 'ids' in args && Array.isArray(args.ids)) {
          this.ids += args.ids.length
        }
      }
    }
    this.queries += 1
    this.durations.push(request.timing().responseEnd)
    this.bytes.push(body.length)
  }
}

async function loginFlutter(page: Page, email: string, password: string): Promise<number> {
  await page.goto(FLUTTER_URL)
  await page.locator('input').first().waitFor()
  await page.evaluate(() => {
    const placeholder = document.querySelector('flt-semantics-placeholder')
    if (placeholder instanceof HTMLElement) placeholder.click()
  })
  await page.waitForTimeout(500)
  await page.mouse.click(1052, 364)
  await page.keyboard.type(email)
  await page.mouse.click(1030, 436)
  await page.keyboard.type(password)
  const start = await page.evaluate(() => performance.now())
  await page.mouse.click(1052, 524)
  return start
}

/** Page time at which the semantics tree shows a list row (its star button) */
function firstRowShown(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>(resolve => {
        const found = (): boolean =>
          Array.from(document.querySelectorAll('flt-semantics')).some(node =>
            /Mark as starred|Not starred|Starred/.test(node.getAttribute('aria-label') ?? node.textContent ?? '')
          )
        const observer = new MutationObserver(() => {
          if (found()) {
            observer.disconnect()
            resolve(performance.now())
          }
        })
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
      })
  )
}

test.describe('PERF tmail-flutter web reference', () => {
  test.skip(FLUTTER_URL === '', 'PERF_FLUTTER_URL is not set')

  test('PERF-F1 login → first row, then continuous scroll to 2 000 emails', async ({ browser }) => {
    const user = readPerfUser()
    const m: Record<string, number[]> = {}
    const add = (name: string, value: number): void => {
      ;(m[name] ??= []).push(value)
    }

    for (let run = 0; run < RUNS; run += 1) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      const counter = new QueryCounter(page)

      const start = await loginFlutter(page, user.email, user.password)
      const first = await firstRowShown(page)
      add('F1. login click → first Inbox row (ms)', first - start)
      await page.waitForTimeout(3000)
      add('F1. first Email/query+get: duration (ms)', counter.durations[0] ?? NaN)
      add('F1. first Email/query+get: response (kB)', (counter.bytes[0] ?? NaN) / 1024)
      const heapBefore = await heapUsedMb(cdp)

      // F3. Continuous wheel scroll over the list until 2 000 ids are loaded
      const queriesBefore = counter.queries
      await page.evaluate(() => {
        const frames: number[] = []
        let last = performance.now()
        const tick = (now: number): void => {
          frames.push(now - last)
          last = now
          if (Reflect.get(window, '__stopFrames') !== true) requestAnimationFrame(tick)
        }
        Reflect.set(window, '__frames', frames)
        requestAnimationFrame(tick)
      })
      const scrollStart = Date.now()
      await page.mouse.move(900, 500)
      while (counter.ids < SCROLL_TARGET && Date.now() - scrollStart < 300_000) {
        await page.mouse.wheel(0, 120)
        await page.waitForTimeout(16)
      }
      const scrollSeconds = (Date.now() - scrollStart) / 1000
      const frames = await page.evaluate(() => {
        Reflect.set(window, '__stopFrames', true)
        const recorded: unknown = Reflect.get(window, '__frames')
        return Array.isArray(recorded) ? recorded.map(Number) : []
      })
      add('F3. scroll to 2 000 emails: duration (s)', scrollSeconds)
      add('F3. pagination requests', counter.queries - queriesBefore)
      const pageDurations = counter.durations.slice(queriesBefore)
      add('F3. mean duration of a page request (ms)', pageDurations.reduce((a, b) => a + b, 0) / Math.max(1, pageDurations.length))
      const pageBytes = counter.bytes.slice(queriesBefore)
      add('F3. mean response of a page (kB)', pageBytes.reduce((a, b) => a + b, 0) / Math.max(1, pageBytes.length) / 1024)
      add('F3. frames longer than 50 ms', frames.filter(frame => frame > 50).length)
      add('F3. frames (total)', frames.length)
      add('F3. JS heap after GC, before scroll (MB)', heapBefore)
      add('F3. JS heap after GC, 2 000 loaded (MB)', await heapUsedMb(cdp))
      await context.close()
    }
    report(m)
  })
})
