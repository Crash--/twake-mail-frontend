import { expect, type Browser, type Page } from '@playwright/test'

import { LoginPage } from '../pages'
import type { Credentials } from '../pages/LoginPage'

export { copyHtml, copyPng, dropPng, makePng } from '../support/clipboard'

/** Opens an email in the React reader, as `reader`, in a fresh context; returns the body frame */
export async function openInReader(
  browser: Browser,
  reader: Credentials,
  subject: string,
  shot: string
): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } })
  const page = await context.newPage()
  const mailbox = await new LoginPage(page).loginAs(reader)
  await mailbox.openEmail(subject)
  const frame = page.getByTestId('email-view-body')
  await expect(frame).toBeVisible()
  // Images inside the frame
  await expect
    .poll(async () =>
      frame.evaluate((element: HTMLIFrameElement) =>
        Array.from(element.contentDocument?.images ?? []).every(image => image.complete)
      )
    )
    .toBe(true)
  await page.screenshot({
    path: `/tmp/twake-mail-shots/spike-composer-${shot}.png`,
    fullPage: true
  })
  return page
}

export const TMAIL_WEB_URL = 'http://127.0.0.1:18503/'

/**
 * Opens the first email of the inbox in tmail-flutter web (linagora/tmail-web, a canvas:
 * no selector, coordinates of its layout at 1280 px wide) and takes a screenshot.
 */
export async function openInTmailWeb(
  browser: Browser,
  reader: Credentials,
  shot: string,
  /** Where tmail-web drew the "•••" toggle of a collapsed quote, to expand it */
  expandQuoteAt: { x: number; y: number } | null = null
): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } })
  const page = await context.newPage()
  await page.goto(TMAIL_WEB_URL)
  await page.waitForTimeout(8000)
  await page.keyboard.type(reader.email)
  await page.keyboard.press('Tab')
  await page.keyboard.type(reader.password)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(10000)
  await page.mouse.click(700, 178)
  await page.waitForTimeout(8000)
  if (expandQuoteAt) {
    await page.mouse.click(expandQuoteAt.x, expandQuoteAt.y)
    await page.waitForTimeout(3000)
  }
  await page.screenshot({ path: `/tmp/twake-mail-shots/spike-composer-${shot}.png` })
  await context.close()
}
