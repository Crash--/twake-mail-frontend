import { type Browser, type Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'
import type { SendEmailInput } from '../support/jmap'

/** A 1×1 PNG */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)
const EVIL = 'https://evil.example.test'

/** A PDF whose catalog runs JavaScript when opened, and links out */
const MALICIOUS_PDF = [
  '%PDF-1.4',
  '1 0 obj << /Type /Catalog /Pages 2 0 R /OpenAction 5 0 R >> endobj',
  '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
  '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Annots [6 0 R] >> endobj',
  '4 0 obj << /Length 0 >> stream',
  '',
  'endstream endobj',
  '5 0 obj << /S /JavaScript /JS (app.alert("PDFJS")) >> endobj',
  `6 0 obj << /Type /Annot /Subtype /Link /Rect [0 0 200 200] /A << /S /URI /URI (${EVIL}/pdf) >> >> endobj`,
  'trailer << /Root 1 0 R /Size 7 >>',
  '%%EOF'
].join('\n')

const MALICIOUS_HTML = `<p onclick="alert('HTMLXSS')">Visible text</p><script>alert('HTMLXSS')</script><img src="${EVIL}/pixel.png"><iframe src="${EVIL}/frame"></iframe><meta http-equiv="refresh" content="0;url=${EVIL}/refresh"><link rel="stylesheet" href="${EVIL}/a.css"><a href="javascript:alert('HTMLXSS')">link</a>`

const MALICIOUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><script>alert('SVGXSS')</script><image href="${EVIL}/svg.png" width="10" height="10"/><rect width="40" height="40" fill="red" onload="alert('SVGXSS')"/></svg>`

const EML = [
  'From: Eve <eve@example.test>',
  'To: alice@example.com',
  'Subject: Nested hello',
  'Date: Mon, 05 Oct 2026 10:00:00 +0000',
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=utf-8',
  '',
  `<p>Nested body</p><script>alert('EMLXSS')</script><img src="${EVIL}/eml.png">`
].join('\r\n')

/**
 * James sometimes answers "Attachment not found" when several blobs were
 * uploaded a moment before: the draft is created again
 */
async function send(
  jmap: { sendEmail: (input: SendEmailInput) => Promise<unknown> },
  input: SendEmailInput
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await jmap.sendEmail(input)
      return
    } catch (error) {
      if (attempt === 3) throw error
    }
  }
}

/** Everything that must stay quiet while a hostile file is previewed */
function watch(page: Page): { dialogs: string[]; external: string[] } {
  const seen = { dialogs: [] as string[], external: [] as string[] }
  page.on('dialog', dialog => {
    seen.dialogs.push(dialog.message())
    void dialog.dismiss()
  })
  const origin = new URL(env.baseUrl).origin
  page.on('request', request => {
    const url = request.url()
    if (/^(data|blob|about):/.test(url) || url.startsWith(origin)) return
    seen.external.push(url)
  })
  return seen
}


/** A PDF of `count` pages, each saying its number (no xref: pdf.js rebuilds it) */
function manyPagesPdf(count: number): string {
  const kids: string[] = []
  const objects: string[] = []
  for (let index = 0; index < count; index += 1) {
    const page = 4 + index * 2
    kids.push(`${page} 0 R`)
    const text = `BT /F1 48 Tf 20 100 Td (Page ${index + 1}) Tj ET`
    objects.push(
      `${page} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >> endobj`,
      `${page + 1} 0 obj << /Length ${text.length} >> stream\n${text}\nendstream endobj`
    )
  }
  return [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${kids.join(' ')}] /Count ${count} >> endobj`,
    '3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ...objects,
    `trailer << /Root 1 0 R /Size ${4 + count * 2} >>`,
    '%%EOF'
  ].join('\n')
}

/**
 * A PDF with an embedded (subset) TrueType font, printed by the browser
 * itself: no dependency, and a real font program for pdf.js to parse
 */
async function embeddedFontPdf(browser: Browser): Promise<Buffer> {
  const page = await browser.newPage()
  try {
    await page.setContent(
      '<body style="font: 32px serif"><p>Embedded font: Hamburgefonstiv 0123456789</p><p style="font-family: sans-serif; font-style: italic">Second font, italic</p></body>'
    )
    return await page.pdf({ width: '8in', height: '4in' })
  } finally {
    await page.close()
  }
}

/** Counts the calls of `eval` and of the `Function` constructor in the page */
async function spyOnEval(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: string[] = []
    Object.defineProperty(window, '__evalCalls', { value: calls })
    const record = (kind: string): void => {
      const stack = new Error().stack ?? ''
      // Playwright evaluates its own scripts with eval
      if (!stack.includes('UtilityScript')) calls.push(`${kind}: ${stack}`)
    }
    window.Function = new Proxy(window.Function, {
      construct(target, args, newTarget) {
        record('new Function')
        return Reflect.construct(target, args, newTarget) as object
      },
      apply(target, thisArg, args) {
        record('Function()')
        return Reflect.apply(target, thisArg, args) as unknown
      }
    })
    window.eval = new Proxy(window.eval, {
      apply(target, thisArg, args) {
        record('eval')
        return Reflect.apply(target, thisArg, args) as unknown
      }
    })
  })
}

async function evalCalls(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __evalCalls: string[] }).__evalCalls
  )
}

/** Rewrites what the server says of the size of the PDF parts */
async function declarePdfSize(page: Page, size: number): Promise<void> {
  const patch = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(patch)
    else if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if (record.type === 'application/pdf' && typeof record.size === 'number') {
        record.size = size
      }
      Object.values(record).forEach(patch)
    }
  }
  await page.route(/\/jmap\/?$/, async route => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fallback()
    const response = await route.fetch()
    const body: unknown = await response.json().catch(() => null)
    if (body === null) return route.fulfill({ response })
    patch(body)
    return route.fulfill({ response, json: body })
  })
}

test.describe('ATT attachments', () => {
  test.use({ emailsOneByOne: true })

  test('ATT-03 cards, preview of an image and of a text file, then close', async ({
    page,
    user,
    jmap
  }) => {
    await send(jmap, {
      to: user.email,
      subject: 'with files',
      text: 'See attached',
      attachments: [
        { name: 'photo.png', type: 'image/png', content: PNG },
        {
          name: 'notes.txt',
          type: 'text/plain',
          content: 'hello <b>notes</b>'
        },
        { name: 'data.zip', type: 'application/zip', content: 'PK' },
        { name: 'more.zip', type: 'application/zip', content: 'PK' }
      ]
    })
    await jmap.waitForEmail({ subject: 'with files' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('with files')

    await expect(email.root.getByText('4 Attachments')).toBeVisible()
    await expect(email.attachments).toHaveCount(3)
    await expectNoA11yViolations(page)

    const card = page.getByRole('button', { name: /^Preview photo\.png/ })
    await card.click()
    const dialog = page.getByRole('dialog', { name: 'photo.png' })
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('attachment-preview-image')).toHaveJSProperty(
      'tagName',
      'IMG'
    )
    await expectNoA11yViolations(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(card).toBeFocused()

    await page.getByRole('button', { name: /^Preview notes\.txt/ }).click()
    // Text, not markup
    await expect(page.getByTestId('attachment-preview-text')).toHaveText(
      'hello <b>notes</b>'
    )
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download', exact: true }).click()
    expect((await download).suggestedFilename()).toBe('notes.txt')
    await page.getByRole('button', { name: 'Close' }).click()

    await email.root.getByTestId('attachment-show-more').click()
    await expect(email.attachments).toHaveCount(4)
  })

  test(
    'ATT-04 a hostile HTML file runs no script and reaches no network',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const seen = watch(page)
      await send(jmap, {
        to: user.email,
        subject: 'html file',
        text: 'See attached',
        attachments: [
          { name: 'page.html', type: 'text/html', content: MALICIOUS_HTML }
        ]
      })
      await jmap.waitForEmail({ subject: 'html file' })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.openEmail('html file')

      await page.getByRole('button', { name: /^Preview page\.html/ }).click()
      const frame = page
        .getByTestId('attachment-preview-html')
        .getByTestId('email-view-body')
      await expect(frame).toHaveAttribute(
        'sandbox',
        'allow-same-origin allow-popups allow-popups-to-escape-sandbox'
      )
      const body = frame.contentFrame().locator('body')
      await expect(body).toContainText('Visible text')
      expect(await body.innerHTML()).not.toMatch(
        /HTMLXSS|<script|<iframe|onclick|javascript:|evil\.example/
      )
      await body.getByText('Visible text').click()
      await expectNoA11yViolations(page)
      expect(seen).toEqual({ dialogs: [], external: [] })
    }
  )

  test('ATT-05 a hostile SVG is an image: no script, no network', async ({
    page,
    user,
    jmap
  }) => {
    const seen = watch(page)
    await send(jmap, {
      to: user.email,
      subject: 'svg file',
      text: 'See attached',
      attachments: [
        // The sender claims HTML for one and SVG for the other
        { name: 'logo.svg', type: 'image/svg+xml', content: MALICIOUS_SVG },
        {
          name: 'other.svg',
          type: 'application/octet-stream',
          content: MALICIOUS_SVG
        }
      ]
    })
    await jmap.waitForEmail({ subject: 'svg file' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openEmail('svg file')

    for (const name of ['logo.svg', 'other.svg']) {
      await page
        .getByRole('button', { name: new RegExp(`^Preview ${name}`) })
        .click()
      const image = page.getByTestId('attachment-preview-image')
      await expect(image).toHaveJSProperty('tagName', 'IMG')
      await expect(image).toHaveJSProperty('complete', true)
      expect(
        await page.getByRole('dialog').locator('iframe, object, embed').count()
      ).toBe(0)
      await page.keyboard.press('Escape')
    }
    // The blob is not an active document: navigating to it as a page is not offered
    expect(seen).toEqual({ dialogs: [], external: [] })
  })

  test('ATT-06 a PDF with JavaScript and links is drawn, nothing runs', async ({
    page,
    user,
    jmap
  }) => {
    const seen = watch(page)
    await send(jmap, {
      to: user.email,
      subject: 'pdf file',
      text: 'See attached',
      attachments: [
        { name: 'bad.pdf', type: 'application/pdf', content: MALICIOUS_PDF }
      ]
    })
    await jmap.waitForEmail({ subject: 'pdf file' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openEmail('pdf file')

    await page.getByRole('button', { name: /^Preview bad\.pdf/ }).click()
    await expect(page.getByRole('img', { name: 'Page 1 of 1' })).toBeVisible({
      timeout: 15_000
    })
    await expect(page.getByTestId('attachment-preview-error')).toHaveCount(0)
    await expectNoA11yViolations(page)
    await page.getByTestId('pdf-preview').click({ position: { x: 20, y: 20 } })
    expect(seen).toEqual({ dialogs: [], external: [] })
  })

  test('ATT-08 a PDF with embedded fonts is drawn without eval, from the app only', async ({
    page,
    browser,
    user,
    jmap
  }) => {
    await spyOnEval(page)
    const seen = watch(page)
    const workerResponse = page.waitForResponse(
      response => /pdf\.worker.*\.mjs$/.test(new URL(response.url()).pathname),
      { timeout: 30_000 }
    )
    await send(jmap, {
      to: user.email,
      subject: 'font pdf',
      text: 'See attached',
      attachments: [
        {
          name: 'fonts.pdf',
          type: 'application/pdf',
          content: await embeddedFontPdf(browser)
        }
      ]
    })
    await jmap.waitForEmail({ subject: 'font pdf' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openEmail('font pdf')

    await page.getByRole('button', { name: /^Preview fonts\.pdf/ }).click()
    const canvas = page.getByRole('img', { name: 'Page 1 of 1' })
    await expect(canvas).toHaveAttribute('data-rendered', 'true', {
      timeout: 15_000
    })
    // The glyphs are on the canvas: drawn from the font programs as paths
    const hasInk = await canvas.evaluate(element => {
      const { width, height } = element as HTMLCanvasElement
      const context = (element as HTMLCanvasElement).getContext('2d')
      const data = context?.getImageData(0, 0, width, height).data ?? []
      for (let index = 0; index < data.length; index += 4) {
        if ((data[index] ?? 255) < 100 && (data[index + 3] ?? 0) > 200) {
          return true
        }
      }
      return false
    })
    expect(hasInk).toBe(true)
    expect(await evalCalls(page)).toEqual([])
    // The worker is a file of the app, under the CSP of its own response
    const worker = await workerResponse
    expect(worker.headers()['content-type']).toMatch(/^text\/javascript/)
    const policy =
      worker.headers()['content-security-policy'] ??
      worker.headers()['content-security-policy-report-only']
    expect(policy).toContain("script-src 'self'")
    expect(policy).not.toMatch(/unsafe-eval|blob:.*worker|worker-src/)
    expect(worker.headers()['x-content-type-options']).toBe('nosniff')
    expect(seen).toEqual({ dialogs: [], external: [] })
  })

  test('ATT-09 a PDF over the size limit is not previewed: download instead', async ({
    page,
    user,
    jmap
  }) => {
    const seen = watch(page)
    await send(jmap, {
      to: user.email,
      subject: 'big pdf',
      text: 'See attached',
      attachments: [
        { name: 'big.pdf', type: 'application/pdf', content: MALICIOUS_PDF }
      ]
    })
    await jmap.waitForEmail({ subject: 'big pdf' })
    // James does not accept an upload over 30 MB: the server is made to
    // declare a bigger part, and the blob is not fetched at all
    await declarePdfSize(page, 31_000_000)
    let downloads = 0
    page.on('request', request => {
      if (request.url().includes('/download/')) downloads += 1
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openEmail('big pdf')

    await page.getByRole('button', { name: /^Preview big\.pdf/ }).click()
    await expect(page.getByTestId('attachment-preview-too-large')).toHaveText(
      'This PDF is larger than 30 MB: download it to read it.'
    )
    await expect(page.getByTestId('pdf-preview')).toHaveCount(0)
    expect(downloads).toBe(0)
    await expectNoA11yViolations(page)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download', exact: true }).click()
    expect((await download).suggestedFilename()).toBe('big.pdf')
    expect(seen).toEqual({ dialogs: [], external: [] })
  })

  test('ATT-10 a PDF of many pages draws the visible pages only', async ({
    page,
    user,
    jmap
  }) => {
    const seen = watch(page)
    await send(jmap, {
      to: user.email,
      subject: 'long pdf',
      text: 'See attached',
      attachments: [
        {
          name: 'long.pdf',
          type: 'application/pdf',
          content: manyPagesPdf(400)
        }
      ]
    })
    await jmap.waitForEmail({ subject: 'long pdf' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openEmail('long pdf')

    await page.getByRole('button', { name: /^Preview long\.pdf/ }).click()
    const canvases = page.getByTestId('pdf-preview').locator('canvas')
    await expect(canvases).toHaveCount(400, { timeout: 30_000 })
    const drawn = page.locator('canvas[data-rendered="true"]')
    await expect(drawn.first()).toBeVisible({ timeout: 15_000 })
    expect(await drawn.count()).toBeLessThan(10)
    expect(await page.locator('canvas[data-page="400"][data-rendered]').count()).toBe(0)

    // Scrolled to the end: the last page is drawn, the first ones released
    await canvases.last().scrollIntoViewIfNeeded()
    await expect(
      page.locator('canvas[data-page="400"][data-rendered="true"]')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.locator('canvas[data-page="1"][data-rendered="true"]')
    ).toHaveCount(0)
    expect(await drawn.count()).toBeLessThan(10)
    expect(seen).toEqual({ dialogs: [], external: [] })
  })

  test('ATT-07 a .eml attachment is previewed like an email, sanitized', async ({
    page,
    user,
    jmap
  }) => {
    const seen = watch(page)
    await send(jmap, {
      to: user.email,
      subject: 'eml file',
      text: 'See attached',
      attachments: [
        { name: 'nested.eml', type: 'message/rfc822', content: EML }
      ]
    })
    await jmap.waitForEmail({ subject: 'eml file' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openEmail('eml file')

    await page.getByRole('button', { name: /^Preview nested\.eml/ }).click()
    const preview = page.getByTestId('attachment-preview-eml')
    await expect(
      preview.getByRole('heading', { name: 'Nested hello' })
    ).toBeVisible()
    const body = preview
      .getByTestId('email-view-body')
      .contentFrame()
      .locator('body')
    await expect(body).toContainText('Nested body')
    expect(await body.innerHTML()).not.toMatch(/EMLXSS|<script|evil\.example/)
    await expectNoA11yViolations(page)
    expect(seen).toEqual({ dialogs: [], external: [] })
  })

  test(
    'ATT-01 "Download all" is offered with the capability, and saves a zip',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const session = await jmap.getSession()
      const advertised = Object.keys(session.capabilities).includes(
        'com:linagora:params:downloadAll'
      )
      await send(jmap, {
        to: user.email,
        subject: 'two files',
        text: 'See attached',
        attachments: [
          { name: 'a.zip', type: 'application/zip', content: 'PK-a' },
          { name: 'b.zip', type: 'application/zip', content: 'PK-b' }
        ]
      })
      await jmap.waitForEmail({ subject: 'two files' })
      const mailbox = await new LoginPage(page).loginAs(user)
      await mailbox.openEmail('two files')

      const button = page.getByTestId('download-all-attachments-button')
      if (!advertised) {
        await expect(button).toHaveCount(0)
        return
      }
      const download = page.waitForEvent('download')
      await button.click()
      expect((await download).suggestedFilename()).toMatch(
        /^TwakeMail-\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.zip$/
      )
    }
  )
})
