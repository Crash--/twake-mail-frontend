import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import { makePng } from './helpers'
import { SpikeComposer } from './SpikeComposer'

async function setUpIdentities(jmap: JmapClient, email: string): Promise<void> {
  const accountId = await jmap.accountId()
  const [identities] = await jmap.request([['Identity/get', { accountId, ids: null }, 'i']])
  const defaultId = (identities?.[1].list as { id: string }[])[0]?.id ?? ''
  await jmap.request([
    [
      'Identity/set',
      {
        accountId,
        update: { [defaultId]: { htmlSignature: '<p>SIGNATURE_MARKER <b>Alice</b></p>' } },
        create: {
          work: { name: 'Work', email, htmlSignature: '<p>WORK_SIGNATURE <i>ACME</i></p>' }
        }
      },
      's'
    ]
  ])
}

test('SPIKE-SIG the signature follows the identity', async ({ page, user, jmap }) => {
  await setUpIdentities(jmap, user.email)
  const composer = await new SpikeComposer(page).open(user)
  await expect.poll(() => composer.editorHtml()).toContain('SIGNATURE_MARKER')
  // The composer opens with the caret on the first line, above the signature
  await expect(composer.editor).toBeFocused()
  await page.keyboard.type('Body text')
  await page.getByTestId('spike-from-select').locator('..').click()
  await page.getByRole('option', { name: /^Work/ }).click()
  const html = await composer.editorHtml()
  expect(html).toContain('WORK_SIGNATURE')
  expect(html).not.toContain('SIGNATURE_MARKER')
  expect(html.indexOf('Body text')).toBeLessThan(html.indexOf('WORK_SIGNATURE'))
  await composer.shot('signature-switched')
  await page.getByTestId('spike-preview-button').click()
  await expect(page.getByTestId('spike-outgoing-html')).toContainText(
    'class="tmail-signature" style="clear: both; display: block;"'
  )
})

test('SPIKE-SIG CMP-10/CMP-12 in a reply: image without focus goes first, image at the caret goes between signature and quote', async ({
  page,
  user,
  jmap
}) => {
  await setUpIdentities(jmap, user.email)
  const imported = await jmap.importEml('reply_email/reply-all.eml')
  const composer = await new SpikeComposer(page).open(user, `?reply=${imported.id}`)
  await expect(page.locator('[data-html-block-view="quote"] iframe')).toBeVisible()
  const png = await makePng(page, 200, 80, 'IMG')

  // CMP-10: the caret where the composer put it, the image lands on the first line
  let chooser = page.waitForEvent('filechooser')
  await composer.button('Insert image').click()
  await (await chooser).setFiles({ name: 'first.png', mimeType: 'image/png', buffer: png })
  await expect(composer.editor.locator('img[data-reference]')).toHaveCount(1)
  let html = await composer.editorHtml()
  expect(html.indexOf('first.png')).toBeLessThan(html.indexOf('SIGNATURE_MARKER'))
  expect(html.indexOf('SIGNATURE_MARKER')).toBeLessThan(html.indexOf('data-html-block="quote"'))

  // CMP-12: the caret right above the quote (a gap cursor after the signature)
  await page.locator('[data-html-block-view="quote"]').click()
  await page.keyboard.press('ArrowLeft')
  chooser = page.waitForEvent('filechooser')
  await composer.button('Insert image').click()
  await (await chooser).setFiles({ name: 'second.png', mimeType: 'image/png', buffer: png })
  await expect(composer.editor.locator('img[data-reference]')).toHaveCount(2)
  html = await composer.editorHtml()
  console.log(html.replace(/<div data-html-block="quote">[\s\S]*$/, '<quote…>'))
  expect(html.indexOf('SIGNATURE_MARKER')).toBeLessThan(html.indexOf('second.png'))
  expect(html.indexOf('second.png')).toBeLessThan(html.indexOf('data-html-block="quote"'))
  await composer.shot('reply-inline-images')
})

test('SPIKE-QUOTE-EDIT "Edit the quoted message" turns the atom into editable content', async ({
  page,
  user,
  jmap
}) => {
  const imported = await jmap.importEml('spike_composer/newsletter.eml')
  const composer = await new SpikeComposer(page).open(user, `?reply=${imported.id}`)
  await page.getByRole('button', { name: 'Edit the quoted message' }).click()
  await expect(page.locator('[data-html-block-view="quote"]')).toHaveCount(0)
  const html = await composer.editorHtml()
  expect(html).not.toContain('data-html-block="quote"')
  expect(html).toContain('The ACME Weekly, October edition')
  await composer.shot('quote-edited')
})
