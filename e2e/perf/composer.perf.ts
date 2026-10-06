import { expect, test } from '@playwright/test'

import { keptComposers } from '../support/composerStorage'
import { JmapClient } from '../support/jmap'
import { percentile, readProbe, startProbe } from './composerProbe'
import { RUNS, readPerfUser, report } from './support'

const KEYS = 'The quick brown fox jumps over the lazy dog, again and again. '

/**
 * Answering a 200 KB newsletter (the quote is an HtmlBlock: the editor never parses it):
 * from the click on Reply to the caret in the text, then the latency of each key typed
 * above the quote, at full speed and with the CPU slowed down 4 times. The email is imported
 * with an old date, at the end of the perf user's Inbox, and opened by its URL.
 */
test.describe('PERF answering a big email', () => {
  for (const cpu of [1, 4]) {
    test(`PERF-04 reply to a 200 KB newsletter, CPU x${cpu}`, async ({
      page
    }) => {
      // 5 runs of a few seconds: a run stuck on a control is an error, not 30 minutes
      test.setTimeout(10 * 60_000)
      const user = readPerfUser()
      const jmap = JmapClient.forUser(user)
      const imported = await jmap.importEml(
        'spike_composer/newsletter-200k.eml',
        'inbox',
        {
          keywords: { $seen: true },
          receivedAt: '2001-01-01T00:00:00Z'
        }
      )
      const m: Record<string, number[]> = {}
      const add = (name: string, value: number): void => {
        ;(m[`4. CPU x${cpu}: ${name}`] ??= []).push(value)
      }
      try {
        for (let run = 0; run < RUNS; run += 1) {
          // One email per screen: the reading view of a single email
          await page.addInitScript(() => {
            window.localStorage.setItem(
              'twake-mail.preferences.thread',
              'false'
            )
          })
          // The sign in brings back to the email asked for
          await page.goto(`/mailbox/${user.inboxId}/email/${imported.id}`)
          await page.getByTestId('login-username-input').fill(user.email)
          await page.getByTestId('login-password-input').fill(user.password)
          await page.getByTestId('login-submit-button').click()
          await expect(page.getByTestId('email-view-subject')).toBeVisible({
            timeout: 30_000
          })
          const cdp = await page.context().newCDPSession(page)
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })

          const clicked = Date.now()
          await page.getByTestId('reply-email-button').click()
          const editor = page.getByTestId('composer-editor')
          await expect(editor).toBeFocused({ timeout: 30_000 })
          add('click Reply → caret in the text (ms)', Date.now() - clicked)

          await startProbe(page)
          await page.keyboard.type(KEYS, { delay: 60 })
          await page.waitForTimeout(300)
          const probe = await readProbe(page)
          add('key → frame, median (ms)', percentile(probe.latencies, 0.5))
          add('key → frame, p95 (ms)', percentile(probe.latencies, 0.95))
          add('long tasks while typing', probe.longTasks.length)

          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
          // Closing saves a draft: drop it, the next run starts again
          await page.getByTestId('composer-close-button').click()
          const dialog = page.getByTestId('confirm-dialog')
          const discard = page.getByTestId('composer-discard-draft-button')
          await expect(dialog.or(discard)).toBeVisible()
          if (await dialog.isVisible())
            await page.getByTestId('confirm-dialog-alternative-button').click()
          else await discard.click()
          // The browser forgets the composer a moment after its window is gone (an
          // IndexedDB removal): leaving before that aborts it, and the next run signs in
          // to a composer that covers the Reply button
          await expect.poll(() => keptComposers(page)).toEqual([])
          await page.goto('about:blank')
        }
      } finally {
        await jmap.request([
          [
            'Email/set',
            { accountId: await jmap.accountId(), destroy: [imported.id] },
            'd'
          ]
        ])
      }
      report(m)
    })
  }
})
