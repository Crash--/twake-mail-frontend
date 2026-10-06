import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { CDPSession, Page } from '@playwright/test'

/**
 * What the composer measures read in the page: key latency, long tasks, and the calls that
 * autosave makes (`editor.getHTML()`, big `JSON.stringify`, IndexedDB writes).
 */

/** Times each key press to the next frame painted, and counts the long tasks */
export async function startProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = { latencies: [] as number[], longTasks: [] as number[] }
    ;(window as unknown as { composerProbe: typeof probe }).composerProbe =
      probe
    window.addEventListener(
      'keydown',
      () => {
        const start = performance.now()
        requestAnimationFrame(() =>
          setTimeout(() => probe.latencies.push(performance.now() - start), 0)
        )
      },
      true
    )
    new PerformanceObserver(list => {
      list.getEntries().forEach(entry => probe.longTasks.push(entry.duration))
    }).observe({ type: 'longtask', buffered: false })
  })
}

export interface Probe {
  latencies: number[]
  longTasks: number[]
}

export async function readProbe(page: Page): Promise<Probe> {
  return page.evaluate(
    () => (window as unknown as { composerProbe: Probe }).composerProbe
  )
}

export function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ??
    NaN
  )
}

/** Calls counted in the page since `resetCounters` */
export interface Counters {
  /** `editor.getHTML()` */
  getHtmlCalls: number
  getHtmlMs: number
  /** Reads of `innerHTML` over 100 KB: the whole document serialized (what `getHTML` does) */
  bigInnerHtmlCalls: number
  bigInnerHtmlMs: number
  /** `JSON.stringify` of a value over 100 KB (the fingerprint, the snapshots) */
  bigStringifyCalls: number
  bigStringifyMs: number
  /** IndexedDB `put` (the composer kept in the browser) */
  idbPuts: number
  /** Synchronous cost of the puts: the structured clone of the record */
  idbPutMs: number
  /** Characters of the body in the last put */
  idbBodyChars: number
  /** Long tasks (> 50 ms): count, total and longest, in ms */
  longTasks: number
  longTaskMs: number
  longestTaskMs: number
}

/** Wraps `editor.getHTML`, `JSON.stringify` and `IDBObjectStore.put` of the page (once) */
export async function installCounters(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      composerCounters?: Counters
      __perf: { longTasks: [number, number][] }
    }
    if (w.composerCounters !== undefined) return
    const counters: Counters = {
      getHtmlCalls: 0,
      getHtmlMs: 0,
      bigInnerHtmlCalls: 0,
      bigInnerHtmlMs: 0,
      bigStringifyCalls: 0,
      bigStringifyMs: 0,
      idbPuts: 0,
      idbPutMs: 0,
      idbBodyChars: 0,
      longTasks: 0,
      longTaskMs: 0,
      longestTaskMs: 0
    }
    w.composerCounters = counters
    const dom = document.querySelector('.ProseMirror') as
      (Element & { editor?: { getHTML: () => string } }) | null
    const editor = dom?.editor
    if (editor !== undefined) {
      const original = editor.getHTML.bind(editor)
      editor.getHTML = () => {
        const start = performance.now()
        const html = original()
        counters.getHtmlCalls += 1
        counters.getHtmlMs += performance.now() - start
        return html
      }
    }
    const inner = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'innerHTML'
    )
    if (inner?.get !== undefined) {
      const read = inner.get
      Object.defineProperty(Element.prototype, 'innerHTML', {
        ...inner,
        get(this: Element): string {
          const start = performance.now()
          const html = read.call(this) as string
          if (html.length > 100_000) {
            counters.bigInnerHtmlCalls += 1
            counters.bigInnerHtmlMs += performance.now() - start
          }
          return html
        }
      })
    }
    const stringify = JSON.stringify.bind(JSON)
    JSON.stringify = ((
      value: unknown,
      replacer?: never,
      space?: never
    ): string => {
      const start = performance.now()
      const out = stringify(value, replacer, space)
      if (typeof out === 'string' && out.length > 100_000) {
        counters.bigStringifyCalls += 1
        counters.bigStringifyMs += performance.now() - start
      }
      return out
    }) as typeof JSON.stringify
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey
    ) {
      const start = performance.now()
      const request = put.call(this, value, key)
      counters.idbPuts += 1
      counters.idbPutMs += performance.now() - start
      const html = (value as { snapshot?: { html?: unknown } } | null)?.snapshot
        ?.html
      if (typeof html === 'string') counters.idbBodyChars = html.length
      return request
    }
  })
}

export async function resetCounters(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      composerCounters: Counters
      __perf: { longTasks: [number, number][] }
    }
    const c = w.composerCounters
    c.getHtmlCalls = 0
    c.getHtmlMs = 0
    c.bigInnerHtmlCalls = 0
    c.bigInnerHtmlMs = 0
    c.bigStringifyCalls = 0
    c.bigStringifyMs = 0
    c.idbPuts = 0
    c.idbPutMs = 0
    w.__perf.longTasks.length = 0
  })
}

export async function readCounters(page: Page): Promise<Counters> {
  return page.evaluate(() => {
    const w = window as unknown as {
      composerCounters: Counters
      __perf: { longTasks: [number, number][] }
    }
    const tasks = w.__perf.longTasks.map(([, duration]) => duration)
    return {
      ...w.composerCounters,
      longTasks: tasks.length,
      longTaskMs: tasks.reduce((sum, duration) => sum + duration, 0),
      longestTaskMs: Math.max(0, ...tasks)
    }
  })
}

/** The functions that cost the most CPU in a `.cpuprofile`, by self time */
export function topFunctions(
  profile: {
    nodes: {
      id: number
      callFrame: { functionName: string; url: string; lineNumber: number }
      hitCount?: number
    }[]
    samples?: number[]
    timeDeltas?: number[]
  },
  count = 15
): { name: string; ms: number }[] {
  const self = new Map<number, number>()
  const samples = profile.samples ?? []
  samples.forEach((id, index) => {
    self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas?.[index] ?? 0))
  })
  const byName = new Map<string, number>()
  for (const node of profile.nodes) {
    const { functionName, url, lineNumber } = node.callFrame
    const name = `${functionName === '' ? '(anonymous)' : functionName} ${url.split('/').pop() ?? ''}:${lineNumber}`
    byName.set(name, (byName.get(name) ?? 0) + (self.get(node.id) ?? 0))
  }
  return [...byName.entries()]
    .map(([name, micro]) => ({ name, ms: micro / 1000 }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, count)
}

/** `PERF_PROFILE=<dir>`: records a CPU profile of the typing and prints its top functions */
export const PROFILE_DIR = process.env.PERF_PROFILE

export async function startProfile(cdp: CDPSession): Promise<void> {
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
  await cdp.send('Profiler.start')
}

export async function stopProfile(
  cdp: CDPSession,
  name: string
): Promise<void> {
  const { profile } = await cdp.send('Profiler.stop')
  if (PROFILE_DIR === undefined || PROFILE_DIR === '') return
  mkdirSync(PROFILE_DIR, { recursive: true })
  writeFileSync(
    path.join(PROFILE_DIR, `${name}.cpuprofile`),
    JSON.stringify(profile)
  )
  console.log(`--- ${name}`)
  for (const { name: fn, ms } of topFunctions(profile))
    console.log(`${ms.toFixed(0).padStart(7)} ms  ${fn}`)
}
