import { expect, test } from '../support/fixtures'
import { copyPng, dropPng, makePng, openInReader, openInTmailWeb } from './helpers'
import { SpikeComposer } from './SpikeComposer'

interface BodyPart {
  type: string
  cid?: string | null
  disposition?: string | null
  size?: number
  subParts?: BodyPart[]
}

test('SPIKE-SEND inline images (button, paste, drop) are sent as cid parts and received by another user', async ({
  page,
  browser,
  user,
  users,
  jmapFor
}) => {
  const bob = await users.create({ prefix: 'bob' })
  const composer = await new SpikeComposer(page).open(user)
  const big = await makePng(page, 2400, 1600, 'BUTTON')
  const pasted = await makePng(page, 320, 120, 'PASTED')
  const dropped = await makePng(page, 320, 120, 'DROPPED')

  await composer.to.fill(bob.email)
  await composer.subject.fill('Spike inline images')
  await composer.editor.click()
  await page.keyboard.type('Three images: ')

  const chooser = page.waitForEvent('filechooser')
  await composer.button('Insert image').click()
  await (await chooser).setFiles({ name: 'big.png', mimeType: 'image/png', buffer: big })
  await expect(composer.editor.locator('img[data-reference]')).toHaveCount(1, { timeout: 20_000 })

  await page.keyboard.press('End')
  await page.keyboard.type(' pasted: ')
  await copyPng(page, pasted)
  await page.keyboard.press('Control+V')
  await expect(composer.editor.locator('img[data-reference]')).toHaveCount(2)

  await dropPng(composer.editor, dropped, 'dropped.png')
  await expect(composer.editor.locator('img[data-reference]')).toHaveCount(3)
  await composer.shot('inline-images-editor')

  const html = await composer.editorHtml()
  expect(html.match(/data-reference="[^"]+@twake.mail"/g)).toHaveLength(3)
  expect(html).toContain('src="blob:')

  await composer.send()

  const bobJmap = jmapFor(bob)
  const received = await bobJmap.waitForEmail({ subject: 'Spike inline images' })
  const [got] = await bobJmap.request([
    [
      'Email/get',
      {
        accountId: await bobJmap.accountId(),
        ids: [received.id],
        properties: ['bodyStructure', 'bodyValues', 'htmlBody'],
        fetchHTMLBodyValues: true,
        bodyProperties: ['partId', 'type', 'disposition', 'cid', 'size', 'subParts']
      },
      'g'
    ]
  ])
  const email = (got?.[1].list as Record<string, unknown>[])[0] ?? {}
  const structure = email.bodyStructure as BodyPart
  console.log(JSON.stringify(structure, null, 1))
  expect(structure.type).toBe('multipart/related')
  expect(structure.subParts?.[0]?.type).toBe('multipart/alternative')
  const images = structure.subParts?.slice(1) ?? []
  expect(images).toHaveLength(3)
  expect(images.every(part => part.disposition === 'inline' && part.cid)).toBe(true)
  // The 2400 px PNG went down to 1280 px before upload
  console.log('original bytes', big.length, 'sent bytes', images.map(part => part.size))
  const htmlValue = Object.values(email.bodyValues as Record<string, { value: string }>)[0]?.value ?? ''
  expect(htmlValue.match(/src="cid:/g)).toHaveLength(3)

  await openInReader(browser, bob, 'Spike inline images', 'inline-images-reader')
  await openInTmailWeb(browser, bob, 'inline-images-tmailweb')
})
