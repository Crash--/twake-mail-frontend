import { expect } from '@playwright/test'

import { summarize } from './support'

/**
 * Budgets of the large drafts of the composer (docs/perf/composer.md). A budget caps the
 * median of a measure; it is about 2 to 3 times what the build measured on the CI-like
 * machine of the docs, so that a noisy runner does not fail it but a regression does.
 * `x1` is the CPU at full speed, `x4` slowed down 4 times (a low-end laptop).
 */
interface Budget {
  /** Matched against the name of the measure, which holds the case and the CPU */
  pattern: RegExp
  x1: number
  x4: number
  /** Why this much */
  why: string
}

const MB = 1_000_000

export const BUDGETS: readonly Budget[] = [
  {
    pattern: /typing: key → frame, median/,
    x1: 50,
    x4: 50,
    why: 'issue #65: no typing latency above 50 ms median on a 2 MB draft'
  },
  {
    pattern: /typing: key → frame, p95/,
    x1: 100,
    x4: 100,
    why: 'twice the median: a key never feels stuck'
  },
  {
    pattern: /typing: long tasks/,
    x1: 5,
    x4: 5,
    why: 'the saves and the render stay out of the keys'
  },
  {
    pattern: /typing: whole-document serializations/,
    x1: 1,
    x4: 1,
    why: 'typing serializes the paragraph typed in, never the document'
  },
  {
    pattern: /open: click on the draft/,
    x1: 2000,
    x4: 6000,
    why: 'opening a 5 MB draft'
  },
  {
    pattern: /local save: longest task/,
    x1: 150,
    x4: 300,
    why: 'the write in the browser does not freeze the page'
  },
  {
    pattern: /save draft: click/,
    x1: 3000,
    x4: 6000,
    why: 'one creation and one destruction of a 4 MB request'
  },
  {
    pattern: /save draft: longest task/,
    x1: 400,
    x4: 1500,
    why: 'building the message is one task'
  },
  {
    pattern: /send: click/,
    x1: 3000,
    x4: 6000,
    why: 'a 4 MB request'
  },
  {
    pattern: /send: longest task/,
    x1: 400,
    x4: 1500,
    why: 'building the message is one task'
  },
  {
    pattern: /refused: click → /,
    x1: 3000,
    x4: 6000,
    why: 'over maxSizeRequest the window says so at once'
  },
  {
    pattern: /1 MB quoted thread.*JMAP request bytes/,
    x1: 2.3 * MB,
    x4: 2.3 * MB,
    why: 'the body goes twice (HTML and text): 2 times its size, a little more'
  },
  {
    pattern: /2 MB (quoted thread|of big tables).*JMAP request bytes/,
    x1: 4.5 * MB,
    x4: 4.5 * MB,
    why: 'the body goes twice (HTML and text): 2 times its size, a little more'
  },
  {
    pattern: /7\. paste.*Ctrl\+V → 200 chips/,
    x1: 500,
    x4: 1500,
    why: '200 addresses pasted become chips at once'
  },
  {
    pattern: /7\. paste.*key → frame in Subject, median/,
    x1: 50,
    x4: 150,
    why: 'the 200 chips are drawn again at each key of the subject (see the doc)'
  }
]

/** Fails when a median is over its budget; `PERF_NO_BUDGET=1` only reports */
export function checkBudgets(measures: Record<string, number[]>): void {
  if (process.env.PERF_NO_BUDGET === '1') return
  for (const [name, samples] of Object.entries(measures)) {
    const budget = BUDGETS.find(candidate => candidate.pattern.test(name))
    if (budget === undefined) continue
    const max = / CPU x4|x4:/.test(name) ? budget.x4 : budget.x1
    expect
      .soft(summarize(samples).median, `${name} (budget: ${budget.why})`)
      .toBeLessThanOrEqual(max)
  }
}
