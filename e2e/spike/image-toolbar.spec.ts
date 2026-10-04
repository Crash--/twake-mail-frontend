import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import { makePng } from './helpers'
import { SpikeComposer } from './SpikeComposer'

test('SPIKE-IMAGE an inline image is resized and removed with the keyboard', async ({
  page,
  user
}) => {
  const composer = await new SpikeComposer(page).open(user)
  const png = await makePng(page, 800, 400, 'RESIZE')
  await composer.editor.click()
  await page.keyboard.type('Before ')
  const chooser = page.waitForEvent('filechooser')
  await composer.button('Insert image').click()
  await (await chooser).setFiles({ name: 'resize.png', mimeType: 'image/png', buffer: png })
  const image = composer.editor.locator('img[data-reference]')
  await expect(image).toHaveCount(1, { timeout: 20_000 })
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(800)

  // The caret is after the image: ArrowLeft selects it, Enter opens its toolbar
  await page.keyboard.press('ArrowLeft')
  const toolbar = page.getByRole('toolbar', { name: 'Image options' })
  await expect(toolbar).toBeVisible()
  await expect(page.getByTestId('rich-text-image-toolbar')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Width 800 px' })).toBeVisible()
  await page.keyboard.press('Enter')
  const quarter = toolbar.getByRole('button', { name: '25%' })
  await expect(quarter).toBeFocused()
  await expectNoA11yViolations(page)

  await page.keyboard.press('Enter')
  await expect(quarter).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status').filter({ hasText: 'Width 200 px, 25%' })).toBeVisible()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowLeft')
  await expect(toolbar.getByRole('button', { name: 'Larger' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Width 280 px, 35%' })).toBeVisible()
  await composer.shot('image-toolbar')
  expect(await composer.editorHtml()).toMatch(/<img[^>]*width="280"[^>]*height="140"/)
  // The outgoing HTML keeps the size
  expect(
    await page.evaluate(() => {
      const spike = window as unknown as {
        spikeEditor: { getHTML: () => string }
        spikeTools: { toEmailHtml: (html: string) => string }
      }
      return spike.spikeTools.toEmailHtml(spike.spikeEditor.getHTML())
    })
  ).toMatch(/<img[^>]*width="280"/)

  // Escape goes back to the text, the image still selected; Enter, End, Enter removes it
  await page.keyboard.press('Escape')
  await expect(composer.editor).toBeFocused()
  await expect(toolbar).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(toolbar.getByRole('button', { name: 'Larger' })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByTestId('rich-text-image-remove-button')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(image).toHaveCount(0)
  await expect(toolbar).toBeHidden()
  await expect(composer.editor).toBeFocused()
})

test('SPIKE-TRAILING a click under a list ending the text gives a line above the signature', async ({
  page,
  user,
  jmap
}) => {
  const accountId = await jmap.accountId()
  const [identities] = await jmap.request([['Identity/get', { accountId, ids: null }, 'i']])
  const identityId = (identities?.[1].list as { id: string }[])[0]?.id ?? ''
  await jmap.request([
    [
      'Identity/set',
      { accountId, update: { [identityId]: { htmlSignature: '<p>SIGNATURE_MARKER</p>' } } },
      's'
    ]
  ])
  const composer = await new SpikeComposer(page).open(user)
  await expect.poll(() => composer.editorHtml()).toContain('SIGNATURE_MARKER')
  await composer.editor.focus()
  await composer.button('Bulleted list').click()
  await page.keyboard.type('item')
  expect(await composer.editorHtml()).toMatch(/<\/ul><div data-html-block="signature"/)

  await composer.editor.getByText('SIGNATURE_MARKER').click()
  await page.keyboard.type('after the list')
  expect(await composer.editorHtml()).toMatch(
    /<\/ul><p>after the list<\/p><div data-html-block="signature"/
  )
})
