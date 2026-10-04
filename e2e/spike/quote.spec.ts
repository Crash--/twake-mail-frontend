import { writeFileSync } from 'node:fs'

import type { Page } from '@playwright/test'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import { openInReader, openInTmailWeb } from './helpers'
import { SpikeComposer } from './SpikeComposer'

const FIXTURES = [
  { name: 'newsletter', eml: 'spike_composer/newsletter.eml' },
  { name: 'outlook', eml: 'no_disposition_inline/no_disposition_inline.eml' },
  { name: 'calendar', eml: 'calendar/calendar_counter.eml' },
  { name: 'base64', eml: 'reply_email_with_image_base64/0.eml' }
] as const

type Approach = 'atom' | 'schema'

interface Structure {
  elements: number
  styled: number
  tables: number
  images: number
  links: number
  text: number
  tags: Record<string, number>
}

interface Measure {
  fixture: string
  approach: Approach
  height: number
  referenceHeight: number
  diffPixels: number
  diffRatio: number
  tagRetention: number
  styleRetention: number
  textRetention: number
  tables: string
  images: string
}

const results: Measure[] = []

async function originalHtml(jmap: JmapClient, id: string): Promise<string> {
  const [response] = await jmap.request([
    [
      'Email/get',
      {
        accountId: await jmap.accountId(),
        ids: [id],
        properties: ['htmlBody', 'bodyValues'],
        fetchHTMLBodyValues: true
      },
      'g'
    ]
  ])
  const email = (response?.[1].list as Record<string, unknown>[])[0] ?? {}
  const parts = email.htmlBody as { partId: string; type: string }[]
  const values = email.bodyValues as Record<string, { value: string }>
  return parts
    .filter(part => part.type === 'text/html')
    .map(part => values[part.partId]?.value ?? '')
    .join('')
}

/** The quoted fragment of the outgoing HTML, for each approach */
async function quotedFragment(page: Page, approach: Approach): Promise<string> {
  return page.evaluate(approach => {
    const tools = (window as unknown as { spikeTools: { toEmailHtml: (html: string) => string } })
      .spikeTools
    const editor = (window as unknown as { spikeEditor: { getHTML: () => string } }).spikeEditor
    const body = new DOMParser().parseFromString(tools.toEmailHtml(editor.getHTML()), 'text/html')
      .body
    const quote =
      approach === 'atom'
        ? body.querySelector('[data-html-block="quote"] > blockquote')
        : Array.from(body.children)
            .filter(child => child.tagName === 'BLOCKQUOTE')
            .pop()
    return quote?.innerHTML ?? ''
  }, approach)
}

/** Renders a fragment as the reader would, in an iframe on top of the page, and measures it */
async function render(
  page: Page,
  html: string,
  id: string
): Promise<{ png: Buffer; structure: Structure; height: number }> {
  const { structure, height } = await page.evaluate(
    async ({ html, id }) => {
      const tools = (
        window as unknown as {
          spikeTools: {
            buildEmailDocument: (html: string) => string
            resolveCidSources: (html: string, urlFor: (cid: string) => string | null) => string
            urlFor: (cid: string) => string | null
          }
        }
      ).spikeTools
      document.getElementById(id)?.remove()
      const frame = document.createElement('iframe')
      frame.id = id
      frame.setAttribute('sandbox', 'allow-same-origin')
      Object.assign(frame.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '900px',
        height: '200px',
        border: '0',
        background: '#fff',
        zIndex: '100000'
      })
      const content = `<div data-html-block="quote">${tools.resolveCidSources(html, tools.urlFor)}</div>`
      frame.srcdoc = tools.buildEmailDocument(content)
      const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }))
      document.body.append(frame)
      await loaded
      const doc = frame.contentDocument
      if (!doc) throw new Error('no frame document')
      await Promise.all(
        Array.from(doc.images).map(image =>
          image.complete ? null : new Promise(resolve => image.addEventListener('load', resolve))
        )
      )
      const contentHeight = Math.ceil(doc.getElementById('tmail-content')?.getBoundingClientRect().height ?? 0)
      frame.style.height = `${Math.max(contentHeight, 10)}px`

      const root = doc.getElementById('tmail-content')?.firstElementChild
      const all = Array.from(root?.querySelectorAll('*') ?? [])
      const tags: Record<string, number> = {}
      all.forEach(element => {
        tags[element.tagName] = (tags[element.tagName] ?? 0) + 1
      })
      return {
        height: contentHeight,
        structure: {
          elements: all.length,
          styled: all.filter(element => element.hasAttribute('style')).length,
          tables: root?.querySelectorAll('table').length ?? 0,
          images: root?.querySelectorAll('img').length ?? 0,
          links: root?.querySelectorAll('a[href]').length ?? 0,
          text: (() => {
            const clone = root?.cloneNode(true)
            if (!(clone instanceof Element)) return 0
            clone.querySelectorAll('style').forEach(style => style.remove())
            return (clone.textContent ?? '').replace(/\s+/g, '').length
          })(),
          tags
        }
      }
    },
    { html, id }
  )
  const png = await page.locator(`#${id}`).screenshot()
  return { png, structure, height }
}

function compare(reference: Buffer, candidate: Buffer, diffPath: string): { pixels: number; ratio: number } {
  const a = PNG.sync.read(reference)
  const b = PNG.sync.read(candidate)
  const width = Math.max(a.width, b.width)
  const height = Math.max(a.height, b.height)
  const pad = (image: PNG): PNG => {
    const padded = new PNG({ width, height })
    padded.data.fill(255)
    PNG.bitblt(image, padded, 0, 0, image.width, image.height, 0, 0)
    return padded
  }
  const diff = new PNG({ width, height })
  const pixels = pixelmatch(pad(a).data, pad(b).data, diff.data, width, height, { threshold: 0.1 })
  writeFileSync(diffPath, PNG.sync.write(diff))
  return { pixels, ratio: pixels / (width * height) }
}

function retention(reference: Record<string, number>, candidate: Record<string, number>): number {
  const total = Object.values(reference).reduce((sum, count) => sum + count, 0)
  if (total === 0) return 1
  const kept = Object.entries(reference).reduce(
    (sum, [tag, count]) => sum + Math.min(count, candidate[tag] ?? 0),
    0
  )
  return kept / total
}

test.describe.configure({ mode: 'serial' })

for (const fixture of FIXTURES) {
  test(`SPIKE-QUOTE fidelity of the quoted ${fixture.name} email, atom node vs editor schema`, async ({
    page,
    user,
    jmap
  }) => {
    const imported = await jmap.importEml(fixture.eml)
    const original = await originalHtml(jmap, imported.id)
    let reference: { png: Buffer; structure: Structure; height: number } | null = null

    for (const approach of ['atom', 'schema'] as const) {
      const composer = await new SpikeComposer(page).open(user, `?reply=${imported.id}&quote=${approach}`)
      if (approach === 'atom') {
        await expect(page.locator('[data-html-block-view="quote"] iframe')).toBeVisible()
      }
      await page.waitForTimeout(1000)
      await composer.shot(`quote-${fixture.name}-${approach}-editor`)

      reference ??= await render(
        page,
        await page.evaluate(
          html =>
            (window as unknown as { spikeTools: { sanitizeQuotedHtml: (html: string) => string } })
              .spikeTools.sanitizeQuotedHtml(html),
          original
        ),
        'spike-reference'
      )
      writeFileSync(`/tmp/twake-mail-shots/spike-composer-quote-${fixture.name}-original.png`, reference.png)

      const fragment = await quotedFragment(page, approach)
      const candidate = await render(page, fragment, 'spike-candidate')
      writeFileSync(
        `/tmp/twake-mail-shots/spike-composer-quote-${fixture.name}-${approach}.png`,
        candidate.png
      )
      const diff = compare(
        reference.png,
        candidate.png,
        `/tmp/twake-mail-shots/spike-composer-quote-${fixture.name}-${approach}-diff.png`
      )
      results.push({
        fixture: fixture.name,
        approach,
        height: candidate.height,
        referenceHeight: reference.height,
        diffPixels: diff.pixels,
        diffRatio: Number(diff.ratio.toFixed(4)),
        tagRetention: Number(retention(reference.structure.tags, candidate.structure.tags).toFixed(3)),
        styleRetention: Number(
          (reference.structure.styled === 0 ? 1 : candidate.structure.styled / reference.structure.styled).toFixed(3)
        ),
        textRetention: Number(
          (reference.structure.text === 0 ? 1 : candidate.structure.text / reference.structure.text).toFixed(3)
        ),
        tables: `${candidate.structure.tables}/${reference.structure.tables}`,
        images: `${candidate.structure.images}/${reference.structure.images}`
      })
      if (approach === 'atom') {
        // The atom keeps the quoted HTML as it is: same structure, same rendering
        expect(retention(reference.structure.tags, candidate.structure.tags)).toBe(1)
      }
    }
    console.table(results.filter(result => result.fixture === fixture.name))
    writeFileSync('/tmp/twake-mail-shots/spike-composer-quote-results.json', JSON.stringify(results, null, 1))
  })
}

test('SPIKE-REPLY a reply quoting a newsletter with a cid logo is sent and read faithfully', async ({
  page,
  browser,
  user,
  users,
  jmap,
  jmapFor
}) => {
  const bob = await users.create({ prefix: 'bob' })
  page.on('console', message => {
    if (message.type() === 'error') console.log('BROWSER', message.text())
  })
  // The newsletter reaches the user, who replies to bob (as a forward, to pick the recipient)
  const imported = await jmap.importEml('spike_composer/newsletter.eml')
  const composer = await new SpikeComposer(page).open(user, `?reply=${imported.id}&mode=forward&quote=atom`)
  await expect(page.locator('[data-html-block-view="quote"] iframe')).toBeVisible()
  await composer.to.fill(bob.email)
  // A click on the quote selects it, the focus stays in the editor, and
  // typing writes above the quote instead of replacing it
  await page.locator('[data-html-block-view="quote"]').click()
  await expect(composer.editor).toBeFocused()
  await page.keyboard.type('Have a look at this newsletter.')
  await composer.shot('forward-editor')
  await composer.send()

  const bobJmap = jmapFor(bob)
  const received = await bobJmap.waitForEmail({ subject: 'Fwd: ACME Weekly newsletter' })
  const [got] = await bobJmap.request([
    [
      'Email/get',
      {
        accountId: await bobJmap.accountId(),
        ids: [received.id],
        properties: ['bodyStructure', 'bodyValues', 'htmlBody', 'textBody'],
        fetchAllBodyValues: true,
        bodyProperties: ['partId', 'type', 'disposition', 'cid', 'subParts']
      },
      'g'
    ]
  ])
  const email = (got?.[1].list as Record<string, unknown>[])[0] ?? {}
  const values = email.bodyValues as Record<string, { value: string }>
  const partValue = (key: 'htmlBody' | 'textBody'): string =>
    values[(email[key] as { partId: string }[])[0]?.partId ?? '']?.value ?? ''
  const html = partValue('htmlBody')
  const text = partValue('textBody')
  writeFileSync('/tmp/twake-mail-shots/spike-composer-forward-sent.html', html)
  writeFileSync('/tmp/twake-mail-shots/spike-composer-forward-sent.txt', text)
  expect(html).toContain('<div>Have a look at this newsletter.</div>')
  expect(html).toContain('------- Forwarded message -------')
  expect(html).toContain('src="cid:logo@newsletter"')
  expect(html).toContain('[data-html-block="quote"] .heading')
  expect(html).toContain('[data-html-block="quote"] > blockquote { margin: 0px')
  expect(JSON.stringify(email.bodyStructure)).toContain('logo@newsletter')
  expect(text).toContain('> The ACME Weekly, October edition')

  await openInReader(browser, bob, 'Fwd: ACME Weekly newsletter', 'forward-reader')
  await openInTmailWeb(browser, bob, 'forward-tmailweb')
})
