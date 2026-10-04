import { writeFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { expect, test } from '../support/fixtures'
import { SpikeComposer } from './SpikeComposer'

interface Run {
  approach: 'atom' | 'schema'
  cpu: number
  serializeOnEachKey: boolean
  openMs: number
  keys: number
  p50: number
  p95: number
  max: number
  longTasks: number
  longTaskMs: number
  getHtmlMs: number
  docNodes: number
}

const runs: Run[] = []

async function startProbe(page: Page, serializeOnEachKey: boolean): Promise<void> {
  await page.evaluate(serialize => {
    const w = window as unknown as {
      spikeEditor: { getHTML: () => string; on: (event: string, fn: () => void) => void }
      spikeProbe: { latencies: number[]; longTasks: number[] }
    }
    const probe = { latencies: [] as number[], longTasks: [] as number[] }
    w.spikeProbe = probe
    // Keystroke to the next frame painted after it
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
    // What a naive autosave would do: serialize the document at each change
    if (serialize) w.spikeEditor.on('update', () => void w.spikeEditor.getHTML())
  }, serializeOnEachKey)
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0) * 10) / 10
}

for (const approach of ['atom', 'schema'] as const) {
  for (const cpu of [1, 4]) {
    for (const serializeOnEachKey of [false, true]) {
      test(`SPIKE-PERF typing in a reply to a 200 KB newsletter, ${approach}, CPU x${cpu}${serializeOnEachKey ? ', getHTML on each key' : ''}`, async ({
        page,
        user,
        jmap
      }) => {
        const imported = await jmap.importEml('spike_composer/newsletter-200k.eml')
        const session = await page.context().newCDPSession(page)
        await session.send('Emulation.setCPUThrottlingRate', { rate: cpu })
        const composer = new SpikeComposer(page)
        const opened = Date.now()
        await composer.open(user, `?reply=${imported.id}&quote=${approach}`)
        const openMs = Date.now() - opened
        await expect(composer.editor).toBeFocused()
        await startProbe(page, serializeOnEachKey)
        const keys = 'The quick brown fox jumps over the lazy dog, again and again. '
        await page.keyboard.type(keys, { delay: 60 })
        await page.waitForTimeout(300)
        const measured = await page.evaluate(() => {
          const w = window as unknown as {
            spikeEditor: { getHTML: () => string; state: { doc: { nodeSize: number; descendants: (fn: () => void) => void } } }
            spikeProbe: { latencies: number[]; longTasks: number[] }
          }
          const start = performance.now()
          const html = w.spikeEditor.getHTML()
          const getHtmlMs = performance.now() - start
          let nodes = 0
          w.spikeEditor.state.doc.descendants(() => {
            nodes += 1
          })
          return { ...w.spikeProbe, getHtmlMs, nodes, htmlBytes: html.length }
        })
        runs.push({
          approach,
          cpu,
          serializeOnEachKey,
          openMs,
          keys: measured.latencies.length,
          p50: percentile(measured.latencies, 0.5),
          p95: percentile(measured.latencies, 0.95),
          max: percentile(measured.latencies, 1),
          longTasks: measured.longTasks.length,
          longTaskMs: Math.round(measured.longTasks.reduce((sum, value) => sum + value, 0)),
          getHtmlMs: Math.round(measured.getHtmlMs * 10) / 10,
          docNodes: measured.nodes
        })
        console.log(JSON.stringify(runs[runs.length - 1]), 'html bytes', measured.htmlBytes)
        writeFileSync('/tmp/twake-mail-shots/spike-composer-perf.json', JSON.stringify(runs, null, 1))
        await session.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      })
    }
  }
}
