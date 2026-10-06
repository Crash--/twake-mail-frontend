import { expect, test } from '@playwright/test'

import { ComposerPage, LoginPage } from '../pages'
import { copyHtml } from '../support/clipboard'
import { JmapClient } from '../support/jmap'
import { E2EUserFactory } from '../support/users'
import { checkBudgets } from './budgets'
import {
  PROFILE_DIR,
  installCounters,
  percentile,
  readCounters,
  readProbe,
  resetCounters,
  startProbe,
  startProfile,
  stopProfile
} from './composerProbe'
import { LARGE_CASES, manyAddresses, type LargeCase } from './largeDrafts'
import { INSTRUMENT_SCRIPT, JmapRecorder, report } from './support'

/** Runs of the large cases: each one imports a draft, opens, types, saves and sends it */
const LARGE_RUNS = Number(process.env.PERF_LARGE_RUNS ?? 3)
/** `PERF_LARGE=thread-2mb,recipients-200` runs some cases only */
const ONLY = (process.env.PERF_LARGE ?? '').split(',').filter(id => id !== '')

/**
 * Large drafts (issue #65): a body of 1, 2 and 5 MB (a long quoted thread, big tables, many
 * inline images), 50 attachments and 200 recipients. Each run imports the draft into the
 * Drafts folder of a fresh user, signs in, then measures, with the CPU at full speed and slowed
 * down 4 times: opening it from the list (click to the editor and its content shown), the
 * latency of each key typed at the top of the body (median and p95), what the autosave does
 * (the calls to `editor.getHTML()`, the big `JSON.stringify` and the IndexedDB writes while
 * typing and once the typing stops), "Save draft" (time and size of the requests), and Send
 * (click to the window closed). The budgets are in docs/perf/composer.md (`perf/budgets.ts`).
 */
test.describe('PERF large drafts of the composer', () => {
  for (const largeCase of LARGE_CASES.filter(
    item => ONLY.length === 0 || ONLY.includes(item.id)
  )) {
    for (const cpu of [1, 4]) {
      test(`PERF-06 ${largeCase.label}, CPU x${cpu}`, async ({ page }) => {
        await measureLargeDraft(page, largeCase, cpu)
      })
    }
  }

  test('PERF-07 paste 200 addresses into To, CPU x1 and x4', async ({
    page
  }) => {
    const users = new E2EUserFactory()
    const user = await users.create({ prefix: 'perf' })
    const m: Record<string, number[]> = {}
    try {
      for (const cpu of [1, 4]) {
        for (let run = 0; run < LARGE_RUNS; run += 1) {
          await page.addInitScript({ path: INSTRUMENT_SCRIPT })
          const mailbox = await new LoginPage(page).loginAs(user)
          const cdp = await page.context().newCDPSession(page)
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
          const composer = await mailbox.compose()
          const addresses = manyAddresses(200)
          await copyHtml(page, addresses.join(', '), addresses.join(', '))
          await composer.recipientInput('to').focus()
          const started = Date.now()
          await page.keyboard.press('Control+V')
          await expect(composer.recipients('to')).toHaveCount(200, {
            timeout: 120_000
          })
          ;(m[
            `7. paste 200 addresses, CPU x${cpu}: Ctrl+V → 200 chips (ms)`
          ] ??= []).push(Date.now() - started)
          await startProbe(page)
          await composer.subjectInput.click()
          await page.keyboard.type('A subject typed with 200 chips around', {
            delay: 60
          })
          await page.waitForTimeout(300)
          const probe = await readProbe(page)
          ;(m[
            `7. paste 200 addresses, CPU x${cpu}: key → frame in Subject, median (ms)`
          ] ??= []).push(percentile(probe.latencies, 0.5))
          ;(m[
            `7. paste 200 addresses, CPU x${cpu}: key → frame in Subject, p95 (ms)`
          ] ??= []).push(percentile(probe.latencies, 0.95))
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
          await composer.closeAnd('discard')
          await page.goto('about:blank')
        }
      }
    } finally {
      await users.cleanup()
    }
    report(m)
    checkBudgets(m)
  })
})

async function measureLargeDraft(
  page: import('@playwright/test').Page,
  largeCase: LargeCase,
  cpu: number
): Promise<void> {
  const users = new E2EUserFactory()
  const user = await users.create({ prefix: 'perf' })
  const jmap = JmapClient.forUser(user)
  const prefix = `5. ${largeCase.label}, CPU x${cpu}`
  const m: Record<string, number[]> = {}
  const add = (name: string, value: number): void => {
    ;(m[`${prefix}: ${name}`] ??= []).push(value)
  }
  const uploads: { count: number; bytes: number } = { count: 0, bytes: 0 }
  page.on('request', request => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname.startsWith('/upload')
    ) {
      uploads.count += 1
      uploads.bytes += request.postDataBuffer()?.length ?? 0
    }
  })
  try {
    for (let run = 0; run < LARGE_RUNS; run += 1) {
      const draft = largeCase.make(
        user.email,
        largeCase.recipients === undefined
          ? [user.email]
          : manyAddresses(largeCase.recipients)
      )
      const subject = await importDraft(jmap, draft.eml)
      await page.addInitScript({ path: INSTRUMENT_SCRIPT })
      const drafts = await jmap.findMailboxByRole('drafts')
      const recorder = new JmapRecorder(page)
      await page.goto(`/mailbox/${drafts.id}`)
      await page.getByTestId('login-username-input').fill(user.email)
      await page.getByTestId('login-password-input').fill(user.password)
      await page.getByTestId('login-submit-button').click()
      const row = page.getByRole('link', { name: subject }).first()
      await row.waitFor({ timeout: 60_000 })
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })

      // Opening: the click on the draft to the content of the window shown
      const composer = new ComposerPage(page)
      await page.evaluate('window.__perf.longTasks.length = 0')
      const profiled =
        PROFILE_DIR !== undefined && PROFILE_DIR !== '' && run === 0
      if (profiled) await startProfile(cdp)
      const clicked = Date.now()
      await row.click()
      // In the page: the locator checks of Playwright walk the whole 2 MB document
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="composer-editor"]') !== null,
        undefined,
        {
          timeout: 120_000
        }
      )
      if (largeCase.id.startsWith('images')) {
        await page.waitForFunction(
          () => {
            const images = Array.from(
              document.querySelectorAll('[data-testid="composer-editor"] img')
            )
            return (
              images.length > 0 &&
              images.every(image => (image as HTMLImageElement).complete)
            )
          },
          undefined,
          { timeout: 120_000 }
        )
      }
      if (largeCase.id.startsWith('attachments'))
        await expect(composer.attachments).toHaveCount(50, { timeout: 120_000 })
      if (largeCase.recipients !== undefined) {
        await expect(composer.recipients('to')).toHaveCount(
          largeCase.recipients,
          { timeout: 120_000 }
        )
      }
      add('open: click on the draft → content shown (ms)', Date.now() - clicked)
      if (profiled) await stopProfile(cdp, `${largeCase.id}-x${cpu}-open`)
      const openTasks = await page.evaluate<[number, number][]>(
        'window.__perf.longTasks'
      )
      add(
        'open: long tasks total (ms)',
        openTasks.reduce((sum, [, duration]) => sum + duration, 0)
      )
      await page.waitForTimeout(1500)

      // Typing at the top of the body
      // Focused, not clicked: with 200 recipients the chips leave the body 66 px of the window
      await composer.editor.focus()
      await page.keyboard.press('Control+Home')
      await installCounters(page)
      await startProbe(page)
      await resetCounters(page)
      const profileName = `${largeCase.id}-x${cpu}-typing`
      if (profiled) await startProfile(cdp)
      await page.keyboard.type(
        'The quick brown fox jumps over the lazy dog, again and again. ',
        { delay: 60 }
      )
      await page.waitForTimeout(300)
      const typed = await readProbe(page)
      const whileTyping = await readCounters(page)
      add('typing: key → frame, median (ms)', percentile(typed.latencies, 0.5))
      add('typing: key → frame, p95 (ms)', percentile(typed.latencies, 0.95))
      add('typing: long tasks', typed.longTasks.length)
      add(
        'typing: whole-document serializations',
        whileTyping.bigInnerHtmlCalls
      )
      add(
        'typing: whole-document serialization total (ms)',
        whileTyping.bigInnerHtmlMs
      )
      if (profiled) await stopProfile(cdp, profileName)

      // Autosave in the browser: what happens once the typing stops
      await resetCounters(page)
      await page.waitForTimeout(2500)
      const kept = await readCounters(page)
      add('local save: IndexedDB writes after typing', kept.idbPuts)
      add('local save: IndexedDB put, synchronous cost (ms)', kept.idbPutMs)
      add('local save: whole-document serializations', kept.bigInnerHtmlCalls)
      add('local save: big JSON.stringify total (ms)', kept.bigStringifyMs)
      add('local save: long tasks total (ms)', kept.longTaskMs)
      add('local save: longest task (ms)', kept.longestTaskMs)

      if (largeCase.refused === true) {
        // The request is over the 10 MB of the server: both are refused, and the window says so
        const refusedAt = Date.now()
        await composer.runMoreAction('save-draft')
        await expect(composer.saveStatus).toHaveText('Draft not saved', {
          timeout: 120_000
        })
        add(
          'save draft refused: click → "Draft not saved" (ms)',
          Date.now() - refusedAt
        )
        const sendRefusedAt = Date.now()
        await composer.sendButton.click()
        await expect(composer.sendError).toBeVisible({ timeout: 120_000 })
        add(
          'send refused: click → error shown (ms)',
          Date.now() - sendRefusedAt
        )
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
        await page.goto('about:blank')
        continue
      }

      // "Save draft": the new version (one creation, one destruction) and its size
      const before = recorder.calls.length
      uploads.count = 0
      uploads.bytes = 0
      await resetCounters(page)
      const saveStarted = Date.now()
      await composer.runMoreAction('save-draft')
      await expect(composer.saveStatus).toHaveText('Draft saved', {
        timeout: 120_000
      })
      add('save draft: click → "Draft saved" (ms)', Date.now() - saveStarted)
      await recorder.idle(page, 800)
      const saved = await readCounters(page)
      const saveCalls = recorder.since(before)
      add(
        'save draft: JMAP request bytes',
        saveCalls.reduce((sum, call) => sum + call.requestBytes, 0)
      )
      add('save draft: upload bytes', uploads.bytes)
      add('save draft: whole-document serializations', saved.bigInnerHtmlCalls)
      add('save draft: big JSON.stringify total (ms)', saved.bigStringifyMs)
      add('save draft: long tasks total (ms)', saved.longTaskMs)
      add('save draft: longest task (ms)', saved.longestTaskMs)

      // Send
      const sentBefore = recorder.calls.length
      await resetCounters(page)
      const sendStarted = Date.now()
      if (profiled) await startProfile(cdp)
      await composer.sendButton.click()
      await page.waitForFunction(
        () => document.querySelector('[data-testid="composer"]') === null,
        undefined,
        {
          timeout: 120_000
        }
      )
      add('send: click → window closed (ms)', Date.now() - sendStarted)
      if (profiled) await stopProfile(cdp, `${largeCase.id}-x${cpu}-send`)
      await recorder.idle(page, 800)
      const sent = await readCounters(page)
      add(
        'send: JMAP request bytes',
        recorder
          .since(sentBefore)
          .reduce((sum, call) => sum + call.requestBytes, 0)
      )
      add('send: long tasks total (ms)', sent.longTaskMs)
      add('send: longest task (ms)', sent.longestTaskMs)

      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      await page.goto('about:blank')
    }
  } finally {
    await users.cleanup()
  }
  report(m)
  checkBudgets(m)
}

/** Puts the message in Drafts, and gives its subject */
async function importDraft(jmap: JmapClient, eml: Buffer): Promise<string> {
  const email = await jmap.importEmlContent(eml, 'drafts', {
    keywords: { $draft: true, $seen: true }
  })
  const subject = typeof email.subject === 'string' ? email.subject : ''
  if (subject === '') throw new Error('The draft has no subject')
  return subject
}
