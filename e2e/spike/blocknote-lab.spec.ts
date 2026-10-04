import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Option C of the spike: BlockNote 0.55 (MPL-2.0) with its Ariakit UI, the lightest of its
 * replaceable UI layers, in a bare page (no twake-mui): accessibility, keyboard, HTML out
 * and in. Needs the lab page served on BLOCKNOTE_LAB_URL (recipe in docs/spikes/composer-tiptap.md, "Option C").
 */
const LAB = process.env.BLOCKNOTE_LAB_URL ?? ''
test.skip(LAB === '', 'BLOCKNOTE_LAB_URL not set')

const FIXTURES = path.resolve(__dirname, '../fixtures')

interface Lab {
  blocksToHTMLLossy: () => Promise<string>
  tryParseHTMLToBlocks: (html: string) => Promise<unknown[]>
  replaceBlocks: (from: unknown[], to: unknown[]) => void
  document: unknown[]
}

test('SPIKE-BLOCKNOTE accessibility, keyboard and HTML of BlockNote (Ariakit UI)', async ({ page }) => {
  await page.goto(LAB)
  const editor = page.locator('.bn-editor[contenteditable="true"]')
  await expect(editor).toBeVisible()
  const attributes = await editor.evaluate(element =>
    Object.fromEntries(Array.from(element.attributes).map(attribute => [attribute.name, attribute.value]))
  )

  // Keyboard path: subject -> editor -> ?
  await page.getByLabel('Subject').focus()
  await page.keyboard.press('Tab')
  const afterSubject = await page.evaluate(() => document.activeElement?.className ?? '')
  await page.keyboard.type('Hello ')
  await page.keyboard.press('Control+B')
  await page.keyboard.type('world')
  await page.keyboard.press('Control+B')
  await page.keyboard.press('Enter')
  await page.keyboard.type('- first')
  await page.keyboard.press('Enter')
  await page.keyboard.type('second')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  const slashMenu = page.getByRole('listbox')
  const slashMenuVisible = await slashMenu.isVisible()
  await page.screenshot({ path: '/tmp/twake-mail-shots/spike-composer-blocknote-slash.png' })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Backspace')
  // Select a word: the formatting toolbar shows up; can the keyboard reach it?
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Shift+Home')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/twake-mail-shots/spike-composer-blocknote-toolbar.png' })
  const toolbarVisible = await page.locator('.bn-formatting-toolbar').isVisible()
  const tabStops: string[] = []
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('Tab')
    tabStops.push(
      await page.evaluate(() => {
        const active = document.activeElement
        return `${active?.tagName ?? ''}.${(active?.className ?? '').toString().slice(0, 40)} "${active?.getAttribute('aria-label') ?? active?.textContent?.slice(0, 20) ?? ''}"`
      })
    )
  }
  // The side menu (drag handle, "+") shows on hover only
  await editor.locator('.bn-block-content').first().hover()
  const sideMenuButtons = await page.locator('.bn-side-menu button, .bn-side-menu [draggable]').count()
  await page.screenshot({ path: '/tmp/twake-mail-shots/spike-composer-blocknote-sidemenu.png' })

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()

  const html = await page.evaluate(async () =>
    (window as unknown as { bnEditor: Lab }).bnEditor.blocksToHTMLLossy()
  )

  // A quoted newsletter, through BlockNote's HTML import and back
  const newsletter = readFileSync(path.join(FIXTURES, 'eml/spike_composer/newsletter.eml'), 'utf8')
  const encoded = newsletter.split('Content-Transfer-Encoding: base64\r\n\r\n')[1]?.split('\r\n--ALT--')[0] ?? ''
  const newsletterHtml = Buffer.from(encoded.replace(/\s+/g, ''), 'base64').toString('utf8')
  const roundTrip = await page.evaluate(async source => {
    const editor = (window as unknown as { bnEditor: Lab }).bnEditor
    const blocks = await editor.tryParseHTMLToBlocks(source)
    editor.replaceBlocks(editor.document, blocks)
    return editor.blocksToHTMLLossy()
  }, newsletterHtml)
  await page.screenshot({ path: '/tmp/twake-mail-shots/spike-composer-blocknote-newsletter.png', fullPage: true })
  const count = (source: string, pattern: RegExp): number => (source.match(pattern) ?? []).length

  const report = {
    editorAttributes: attributes,
    focusAfterSubjectTab: afterSubject,
    slashMenuVisible,
    toolbarVisible,
    tabStopsFromSelection: tabStops,
    sideMenuButtons,
    axeViolations: axe.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
      targets: violation.nodes.slice(0, 3).map(node => node.target.join(' '))
    })),
    exportedHtml: html,
    newsletter: {
      tables: `${count(roundTrip, /<table/g)}/${count(newsletterHtml, /<table/g)}`,
      styled: `${count(roundTrip, /style="/g)}/${count(newsletterHtml, /style="/g)}`,
      images: `${count(roundTrip, /<img/g)}/${count(newsletterHtml, /<img/g)}`,
      bytes: `${roundTrip.length}/${newsletterHtml.length}`
    }
  }
  console.log(JSON.stringify(report, null, 1))
  writeFileSync('/tmp/twake-mail-shots/spike-composer-blocknote-report.json', JSON.stringify(report, null, 1))
  writeFileSync('/tmp/twake-mail-shots/spike-composer-blocknote-newsletter.html', roundTrip)
})
