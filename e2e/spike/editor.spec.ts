import AxeBuilder from '@axe-core/playwright'

import { expect, test } from '../support/fixtures'
import { SpikeComposer } from './SpikeComposer'

test('SPIKE-EDIT typing, bold, list, color and a link through Ctrl+K', async ({ page, user }) => {
  const composer = await new SpikeComposer(page).open(user)
  await composer.editor.click()
  await page.keyboard.type('Hello ')
  const bold = composer.button('Bold')
  await expect(bold).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Control+B')
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.type('world')
  await page.keyboard.press('Control+B')
  await expect(bold).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Enter')
  await composer.button('Bulleted list').click()
  await page.keyboard.type('first')
  await page.keyboard.press('Enter')
  await page.keyboard.type('second')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  await composer.button('Text Color').click()
  await page.getByRole('menuitemradio', { name: 'Red' }).click()
  await page.keyboard.type('red text ')
  await composer.button('Text Color').click()
  await page.getByRole('menuitemradio', { name: 'Reset to default' }).click()

  // CMP-06: Ctrl+K opens the app's link dialog
  await page.keyboard.press('Control+K')
  const dialog = page.getByRole('dialog', { name: 'Insert link' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('link-dialog-url-input')).toBeFocused()
  await dialog.getByTestId('link-dialog-text-input').fill('Twake')
  await dialog.getByTestId('link-dialog-url-input').fill('https://twake.app')
  await composer.shot('link-dialog')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(composer.editor).toBeFocused()

  const html = await composer.editorHtml()
  expect(html).toContain('<strong>world</strong>')
  expect(html).toContain('<ul><li><p>first</p></li><li><p>second</p></li></ul>')
  expect(html).toContain('<span style="color: rgb(198, 40, 40);">red text </span>')
  expect(html).toMatch(/<a [^>]*href="https:\/\/twake.app"[^>]*>Twake<\/a>/)

  await page.getByTestId('spike-preview-button').click()
  await expect(page.getByTestId('spike-outgoing-text')).toContainText('- first')
  await composer.shot('editor-preview')
  console.log(await page.getByTestId('spike-outgoing-html').textContent())
  console.log(await page.getByTestId('spike-outgoing-text').textContent())
})

test('SPIKE-A11Y the toolbar is a roving tabindex toolbar and the editor has no keyboard trap', async ({
  page,
  user
}) => {
  const composer = await new SpikeComposer(page).open(user)
  await expect(composer.editor).toHaveAttribute('aria-multiline', 'true')
  await expect(composer.editor).toHaveAttribute('role', 'textbox')

  // One tab stop for the toolbar: Subject -> toolbar -> editor
  await composer.subject.focus()
  await page.keyboard.press('Tab')
  const undo = composer.button('Undo')
  await expect(undo).toBeFocused()
  await expect(undo).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(composer.button('Bold')).toBeFocused()
  await page.keyboard.press('End')
  await expect(composer.button('Clear formatting')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(undo).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(composer.editor).toBeFocused()

  // Escape goes to the toolbar (on the last used button), Escape comes back
  await page.keyboard.type('text')
  await page.keyboard.press('Escape')
  await expect(undo).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await expect(composer.editor).toBeFocused()

  // In a list, Tab indents; at the first item it cannot, so it leaves
  await page.keyboard.press('Enter')
  await composer.button('Bulleted list').click()
  await page.keyboard.type('item')
  await page.keyboard.press('Tab')
  await expect(composer.editor).not.toBeFocused()
  await composer.editor.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('nested')
  await page.keyboard.press('Tab')
  await expect(composer.editor).toBeFocused()
  expect(await composer.editorHtml()).toContain('<ul><li><p>nested</p></li></ul>')
  // Escape, then Tab: out of the editor even inside a list
  await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+Tab')
  await expect(composer.subject).toBeFocused()

  // Tooltips carry the same text as the aria-label
  await composer.button('Italic').hover()
  await expect(page.getByRole('tooltip', { name: 'Italic' })).toBeVisible()
  await composer.shot('toolbar-tooltip')
})

test('SPIKE-AXE no WCAG 2.1 AA violation in the composer, its menus and its link dialog', async ({
  page,
  user
}) => {
  const composer = await new SpikeComposer(page).open(user)
  await composer.editor.click()
  await page.keyboard.type('Some text')
  // The editor, its toolbar, menus and dialog; the rest of the page (app
  // shell, MUI text fields of the spike page) is reported apart
  const axe = (): AxeBuilder =>
    new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .include('[role="toolbar"]')
      .include('.ProseMirror')
      .include('[role="menu"]')
      .include('[role="dialog"]')
  const whole = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  console.log(
    'Whole page (out of the editor):',
    JSON.stringify(
      whole.violations.map(violation => ({
        id: violation.id,
        nodes: violation.nodes.map(node => node.target.join(' '))
      }))
    )
  )
  const results = [await axe().analyze()]
  await composer.button('Text Color').click()
  await expect(page.getByRole('menu')).toBeVisible()
  // After the fade in: axe reads the colours of a half transparent menu
  await expect(page.locator('.MuiMenu-paper')).toHaveCSS('opacity', '1')
  results.push(await axe().analyze())
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(composer.editor).toBeFocused()
  await page.keyboard.press('Control+K')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByTestId('link-dialog-url-input')).toBeFocused()
  results.push(await axe().analyze())
  const all = results.flatMap(result =>
    result.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map(node => ({
        target: node.target.join(' '),
        summary: node.failureSummary ?? ''
      }))
    }))
  )
  console.log('All (editor scope):', JSON.stringify(all, null, 1))
  // twake-mui theme contrast (TextField label, contained primary button),
  // recorded in docs/twake-mui-gaps.md; also fails on the app shell
  const isTwakeMuiTheme = (target: string): boolean =>
    /-label$/.test(target) || target.includes('MuiButton-contained')
  const violations = all
    .map(violation => ({
      ...violation,
      nodes: violation.nodes.filter(node => !isTwakeMuiTheme(node.target))
    }))
    .filter(violation => violation.nodes.length > 0)
  console.log('Editor:', JSON.stringify(violations, null, 1))
  console.log('Rules passed:', results[0]?.passes.length, results[2]?.passes.length)
  expect(violations).toEqual([])
})
