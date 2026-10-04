import { expect, type Browser, type Locator, type Page } from '@playwright/test'

import { LoginPage } from '../pages'
import type { Credentials } from '../pages/LoginPage'

/** A PNG drawn by the browser: a gradient, a label, `width` x `height` */
export async function makePng(
  page: Page,
  width: number,
  height: number,
  label: string
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ width, height, label }) => {
      const canvas = new OffscreenCanvas(width, height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('no 2d context')
      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#1565c0')
      gradient.addColorStop(1, '#ef6c00')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      // Noise, so that the PNG does not compress to nothing (a photo-like weight)
      const image = context.getImageData(0, 0, width, height)
      for (let index = 0; index < image.data.length; index += 4) {
        const noise = (Math.random() - 0.5) * 40
        image.data[index] = (image.data[index] ?? 0) + noise
        image.data[index + 1] = (image.data[index + 1] ?? 0) + noise
      }
      context.putImageData(image, 0, 0)
      context.fillStyle = '#ffffff'
      context.font = `bold ${Math.round(height / 4)}px sans-serif`
      context.fillText(label, width / 10, height / 2)
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      bytes.forEach(byte => {
        binary += String.fromCharCode(byte)
      })
      return btoa(binary)
    },
    { width, height, label }
  )
  return Buffer.from(base64, 'base64')
}

/** Puts HTML (and its text) on the real clipboard: Ctrl+V then pastes it as a user would */
export async function copyHtml(page: Page, html: string, text: string): Promise<void> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(
    async ({ html, text }) => {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ])
    },
    { html, text }
  )
}

/** Puts a PNG on the real clipboard */
export async function copyPng(page: Page, png: Buffer): Promise<void> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })
    ])
  }, png.toString('base64'))
}

/** Drops a PNG file on an element, as from the file manager */
export async function dropPng(target: Locator, png: Buffer, name: string): Promise<void> {
  const box = await target.boundingBox()
  if (!box) throw new Error('drop target not visible')
  await target.evaluate(
    (element, { base64, name, x, y }) => {
      const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], name, { type: 'image/png' }))
      for (const type of ['dragenter', 'dragover', 'drop']) {
        element.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
            clientX: x,
            clientY: y
          })
        )
      }
    },
    { base64: png.toString('base64'), name, x: box.x + 20, y: box.y + 10 }
  )
}

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
