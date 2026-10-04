import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '../support/fixtures'
import { copyHtml } from './helpers'
import { SpikeComposer } from './SpikeComposer'

const CLIPBOARD = path.resolve(__dirname, '../fixtures/clipboard')

function fixture(name: string): { html: string; text: string } {
  return {
    html: readFileSync(path.join(CLIPBOARD, `${name}.html`), 'utf8'),
    text: readFileSync(path.join(CLIPBOARD, `${name}.txt`), 'utf8')
  }
}

const NOISE = [/<span>/, /mso-/i, /class=/, /o:p/, /font-family/, /font-size/, /line-height/, /Liberation/, /·/, /rgb\(0, 0, 0\)/, /#000000/, /rgb\(33, 37, 41\)/]

const CASES: { name: string; expected: (string | RegExp)[] }[] = [
  {
    name: 'word',
    expected: [
      '<span style="color: rgb(47, 84, 150);"><strong>Compte rendu de réunion</strong></span>',
      '<em>italique</em>',
      '<u>souligné</u>',
      '<ul><li><p>Premier point</p><ul><li><p>Sous-point</p></li></ul></li><li><p>Deuxième point</p></li></ul>',
      '<ol><li><p>Étape un</p></li><li><p>Étape deux</p></li></ol>'
    ]
  },
  {
    name: 'gdocs',
    expected: [
      '<strong>Titre en gras</strong>',
      '<em>italique</em>',
      '<span style="background-color: rgb(255, 255, 0); color: rgb(255, 0, 0);">surligné</span>',
      '<ul><li><p>Item un</p></li><li><p>Item deux</p></li></ul>',
      /<a [^>]*href="https:\/\/example.com\/doc"[^>]*>un lien<\/a>/
    ]
  },
  {
    name: 'libreoffice',
    expected: [
      '<strong>Titre LibreOffice</strong>',
      '<p style="text-align: center;"><span style="color: rgb(201, 33, 30);">Texte rouge centré</span></p>',
      '<ul><li><p>Puce un</p></li><li><p>Puce deux</p></li></ul>',
      '<ol><li><p>Numéro un</p></li></ol>'
    ]
  },
  {
    name: 'web',
    expected: [
      '<p><strong>Titre de section</strong></p>',
      '<th><p>Col A</p></th>',
      /<a [^>]*href="https:\/\/example.org\/doc"[^>]*>un lien<\/a>/,
      'Col A',
      'Attention : alerte'
    ]
  }
]

const outputs: Record<string, string> = {}

for (const { name, expected } of CASES) {
  test(`SPIKE-PASTE ${name}: clean HTML, real lists, no stray styles`, async ({ page, user }) => {
    const composer = await new SpikeComposer(page).open(user)
    const { html, text } = fixture(name)
    await composer.editor.click()
    await copyHtml(page, html, text)
    await page.keyboard.press('Control+V')
    await expect.poll(() => composer.editorHtml()).not.toBe('<p></p>')
    const result = await composer.editorHtml()
    outputs[name] = result
    writeFileSync(`/tmp/twake-mail-shots/spike-composer-paste-${name}.html`, result)
    await composer.shot(`paste-${name}`)
    for (const fragment of expected) {
      if (typeof fragment === 'string') expect(result).toContain(fragment)
      else expect(result).toMatch(fragment)
    }
    for (const noise of NOISE) expect(result).not.toMatch(noise)
  })
}

test('SPIKE-PASTE Ctrl+Shift+V pastes the Word fragment as plain text', async ({ page, user }) => {
  const composer = await new SpikeComposer(page).open(user)
  const { html, text } = fixture('word')
  await composer.editor.click()
  await copyHtml(page, html, text)
  await page.keyboard.press('Control+Shift+V')
  await expect.poll(() => composer.editorHtml()).toContain('Premier point')
  const result = await composer.editorHtml()
  writeFileSync('/tmp/twake-mail-shots/spike-composer-paste-plain.html', result)
  expect(result).not.toContain('<strong>')
  expect(result).not.toContain('<ul>')
  expect(result).toContain('<p>Compte rendu de réunion</p>')
})
