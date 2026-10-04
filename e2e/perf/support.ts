import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

import type { CDPSession, Page, Request } from '@playwright/test'

import type { PerfUser } from '../scripts/seed-perf'

/** Runs per measure; PERF_RUNS=1 for a quick try */
export const RUNS = Number(process.env.PERF_RUNS ?? 5)
export const RESULTS_FILE = path.join(__dirname, '..', 'test-results', 'perf', 'results.json')
export const INSTRUMENT_SCRIPT = path.join(__dirname, 'instrument.js')
const USER_FILE = path.join(__dirname, '.perf-user.json')

export function readPerfUser(): PerfUser {
  const value: unknown = JSON.parse(readFileSync(USER_FILE, 'utf8'))
  if (typeof value !== 'object' || value === null || !('email' in value)) {
    throw new Error(`${USER_FILE} is not a perf user`)
  }
  return value as PerfUser
}

/** What instrument.js keeps in `window.__perf` */
export interface PageMarks {
  firstRow: number | null
  bodyShown: number | null
  lastClick: number | null
  subjectShown: number | null
  subjectFocused: number | null
  rowFocused: number | null
  /** View transitions started since the page loaded */
  transitions: number
  transitionEnd: number | null
  longTasks: [number, number][]
}

export async function readMarks(page: Page): Promise<PageMarks> {
  return page.evaluate<PageMarks>('window.__perf')
}

export async function resetMarks(page: Page): Promise<void> {
  await page.evaluate(
    'Object.assign(window.__perf, { firstRow: null, bodyShown: null, subjectShown: null, subjectFocused: null, rowFocused: null, transitionEnd: null })'
  )
}

/** One JMAP API call seen by the browser */
export interface JmapCall {
  methods: string[]
  /** Epoch ms */
  start: number
  /** Milliseconds from the request start to the end of the response */
  duration: number
  /** Bytes of the response body (decoded) */
  responseBytes: number
  requestBytes: number
}

/** Records the JMAP POSTs of a page, and how many are in flight */
export class JmapRecorder {
  readonly calls: JmapCall[] = []
  #inFlight = 0

  constructor(page: Page) {
    page.on('request', request => {
      if (this.#isApi(request)) this.#inFlight += 1
    })
    const done = (request: Request): void => {
      if (this.#isApi(request)) this.#inFlight -= 1
    }
    page.on('requestfailed', done)
    page.on('requestfinished', request => {
      if (!this.#isApi(request)) return
      void this.#record(request).finally(() => {
        done(request)
      })
    })
  }

  get inFlight(): number {
    return this.#inFlight
  }

  #isApi(request: Request): boolean {
    return request.method() === 'POST' && new URL(request.url()).pathname === '/jmap'
  }

  async #record(request: Request): Promise<void> {
    const response = await request.response()
    const body = response === null ? Buffer.alloc(0) : await response.body()
    const postData = request.postData() ?? '{}'
    const parsed: unknown = JSON.parse(postData)
    const calls =
      typeof parsed === 'object' && parsed !== null && 'methodCalls' in parsed && Array.isArray(parsed.methodCalls)
        ? parsed.methodCalls
        : []
    const timing = request.timing()
    this.calls.push({
      methods: calls.map((call: unknown) => (Array.isArray(call) ? String(call[0]) : '?')),
      start: timing.startTime,
      duration: timing.responseEnd,
      responseBytes: body.length,
      requestBytes: Buffer.byteLength(postData)
    })
  }

  since(index: number): JmapCall[] {
    return this.calls.slice(index)
  }

  /** Resolves once no JMAP request has been in flight for `quietMs` */
  async idle(page: Page, quietMs = 1500, timeoutMs = 120_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    let quietSince = Date.now()
    let seen = this.calls.length
    while (Date.now() < deadline) {
      if (this.#inFlight > 0 || this.calls.length !== seen) {
        quietSince = Date.now()
        seen = this.calls.length
      } else if (Date.now() - quietSince >= quietMs) {
        return
      }
      await page.waitForTimeout(100)
    }
    throw new Error('JMAP requests did not settle')
  }
}

/**
 * Starts waiting in the page for `selector` (or an element matching it whose text contains
 * `text`), returns a promise of the page time it appeared at. Start it before the action.
 */
export function waitInPage(page: Page, selector: string, text: string | null = null): Promise<number> {
  return page.evaluate(
    ([sel, wanted]) =>
      new Promise<number>(resolve => {
        const found = (): boolean =>
          Array.from(document.querySelectorAll(sel)).some(
            element => wanted === null || (element.textContent ?? '').includes(wanted)
          )
        if (found()) {
          resolve(performance.now())
          return
        }
        const observer = new MutationObserver(() => {
          if (found()) {
            observer.disconnect()
            resolve(performance.now())
          }
        })
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
      }),
    [selector, text] as const
  )
}

export async function heapUsedMb(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage')
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  return usedSize / 1024 / 1024
}

export async function login(page: Page, user: PerfUser): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-username-input').fill(user.email)
  await page.getByTestId('login-password-input').fill(user.password)
  await page.getByTestId('login-submit-button').click()
}

/** Median and p95 (nearest rank: with 5 samples, the maximum) */
export interface Summary {
  samples: number[]
  median: number
  p95: number
}

export function summarize(samples: number[]): Summary {
  const sorted = [...samples].sort((a, b) => a - b)
  const at = (rank: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1))] ?? NaN
  const middle = sorted.length / 2
  const median =
    sorted.length % 2 === 1
      ? (sorted[Math.floor(middle)] ?? NaN)
      : ((sorted[middle - 1] ?? NaN) + (sorted[middle] ?? NaN)) / 2
  return { samples, median, p95: at(0.95) }
}

/** Adds measures to test-results/perf/results.json and prints them */
export function report(measures: Record<string, number[]>): void {
  mkdirSync(path.dirname(RESULTS_FILE), { recursive: true })
  const previous: unknown = existsSync(RESULTS_FILE) ? JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) : {}
  const all: Record<string, Summary> = typeof previous === 'object' && previous !== null ? { ...previous } : {}
  for (const [name, samples] of Object.entries(measures)) {
    all[name] = summarize(samples)
    const { median, p95 } = all[name]
    console.log(`${name.padEnd(58)} median ${median.toFixed(1).padStart(9)}   p95 ${p95.toFixed(1).padStart(9)}   [${samples.map(sample => sample.toFixed(1)).join(', ')}]`)
  }
  writeFileSync(RESULTS_FILE, `${JSON.stringify(all, null, 2)}\n`)
}
