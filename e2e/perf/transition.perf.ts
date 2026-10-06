import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { INSTRUMENT_SCRIPT, RUNS, login, readMarks, readPerfUser, report, resetMarks, type PageMarks } from './support'

const LIST_ROW = '[data-testid="email-list-item"]'

/** The screens of the measure: one view at a time on a phone, the lighter effect on a desktop */
const SCREENS = {
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false }
} as const

async function newPage(
  browser: Browser,
  screen: keyof typeof SCREENS,
  reducedMotion: 'reduce' | 'no-preference'
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...SCREENS[screen], reducedMotion })
  await context.addInitScript({ path: INSTRUMENT_SCRIPT })
  // One email per row and the reading view of one email (`email-view-subject`): conversations,
  // the default, open another view
  await context.addInitScript(() => {
    window.localStorage.setItem('twake-mail.preferences.thread', 'false')
  })
  return { context, page: await context.newPage() }
}

function since(marks: PageMarks, mark: number | null, name: string): number {
  if (mark === null || marks.lastClick === null) throw new Error(`No ${name} mark`)
  return mark - marks.lastClick
}

/**
 * Opening an email from the list and going back, with the view transition (issue #12): when
 * the subject is in the DOM and focused, when the body frame is loaded, and when the
 * animation is over (the subject or the row otherwise, without a transition).
 */
test.describe('PERF opening an email', () => {
  for (const screen of ['phone', 'desktop'] as const) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      test(`PERF-03 open and close an email, ${screen}, motion ${reducedMotion}`, async ({ browser }) => {
        const user = readPerfUser()
        const m: Record<string, number[]> = {}
        const label = `${screen}${reducedMotion === 'reduce' ? ', reduced motion' : ''}`
        const add = (name: string, value: number): void => {
          ;(m[`3. ${label}: ${name}`] ??= []).push(value)
        }

        for (let run = 0; run < RUNS; run += 1) {
          const { context, page } = await newPage(browser, screen, reducedMotion)
          await login(page, user)
          await expect(page.locator(LIST_ROW).first()).toBeVisible()

          // A read email (an unread one would be marked read: see the README quirks)
          const row = page.locator(`${LIST_ROW}:not([data-unread])`).nth(2)
          await expect(row).toBeVisible()
          await resetMarks(page)
          const transitionsBefore = (await readMarks(page)).transitions
          await row.locator('[data-row-focus]').click()
          await expect(page.getByTestId('email-view-subject')).toBeFocused()
          await expect.poll(async () => (await readMarks(page)).bodyShown).not.toBeNull()
          const animated = (await readMarks(page)).transitions > transitionsBefore
          if (animated) await expect.poll(async () => (await readMarks(page)).transitionEnd).not.toBeNull()
          let marks = await readMarks(page)
          add('click → subject in the DOM (ms)', since(marks, marks.subjectShown, 'subject'))
          add('click → subject focused (ms)', since(marks, marks.subjectFocused, 'focus'))
          add('click → body frame loaded (ms)', since(marks, marks.bodyShown, 'body'))
          add(
            'click → animation over (ms)',
            since(marks, animated ? marks.transitionEnd : marks.subjectShown, 'transition end')
          )
          add('view transitions on opening', animated ? 1 : 0)

          await resetMarks(page)
          const backBefore = (await readMarks(page)).transitions
          await page.getByTestId('email-view-back-button').click()
          await expect(page.locator(`${LIST_ROW} [data-row-focus]:focus`)).toBeVisible()
          const backAnimated = (await readMarks(page)).transitions > backBefore
          if (backAnimated) await expect.poll(async () => (await readMarks(page)).transitionEnd).not.toBeNull()
          marks = await readMarks(page)
          add('back → row focused (ms)', since(marks, marks.rowFocused, 'row focus'))
          add(
            'back → animation over (ms)',
            since(marks, backAnimated ? marks.transitionEnd : marks.rowFocused, 'transition end')
          )
          await context.close()
        }
        report(m)
      })
    }
  }
})
