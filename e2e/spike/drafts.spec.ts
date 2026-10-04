import { writeFileSync } from 'node:fs'

import { expect, test } from '../support/fixtures'
import { makePng } from './helpers'
import { SpikeComposer } from './SpikeComposer'

test('SPIKE-DRAFT autosave: debounced, one draft kept (create + destroy in one request), network cost', async ({
  page,
  user,
  jmap
}) => {
  const composer = await new SpikeComposer(page).open(user)
  const saves: number[] = []
  page.on('request', request => {
    const body = request.postData() ?? ''
    if (request.url().includes('/jmap') && body.includes('"Email/')) {
      saves.push(Buffer.byteLength(body))
    }
  })
  await composer.subject.fill('Autosaved draft')
  await composer.editor.click()
  // 120 keystrokes, 40 ms apart: no save while typing
  await page.keyboard.type('The quick brown fox jumps over the lazy dog. '.repeat(3).slice(0, 120), {
    delay: 40
  })
  await expect(composer.status).toHaveAttribute('data-saves', '1', { timeout: 10_000 })
  await page.keyboard.type(' And a second burst.', { delay: 40 })
  await expect(composer.status).toHaveAttribute('data-saves', '2', { timeout: 10_000 })
  const draftId = await composer.status.getAttribute('data-draft-id')

  const [got] = await jmap.request([
    [
      'Email/query',
      { accountId: await jmap.accountId(), filter: { inMailbox: (await jmap.findMailboxByRole('drafts')).id } },
      'q'
    ]
  ])
  expect(got?.[1].ids).toEqual([draftId])
  const draft = await jmap.getEmail(draftId ?? '')
  expect(draft.subject).toBe('Autosaved draft')
  const stats = {
    keystrokes: 120 + ' And a second burst.'.length,
    requests: saves.length,
    bytesPerSave: saves,
    status: {
      lastBytes: await composer.status.getAttribute('data-last-bytes'),
      totalBytes: await composer.status.getAttribute('data-total-bytes')
    }
  }
  console.log(JSON.stringify(stats))
  writeFileSync('/tmp/twake-mail-shots/spike-composer-draft-stats.json', JSON.stringify(stats, null, 1))
  // Two saves, one request each (create + destroy, get of the created one)
  expect(saves).toHaveLength(2)
})

test('SPIKE-DRAFT CMP-18 a draft with an inline image reopens with its image and saves again', async ({
  page,
  browser,
  user,
  jmap
}) => {
  const composer = await new SpikeComposer(page).open(user)
  await composer.subject.fill('Draft with image')
  await composer.editor.focus()
  await page.keyboard.type('Image below: ')
  const chooser = page.waitForEvent('filechooser')
  await composer.button('Insert image').click()
  await (await chooser).setFiles({
    name: 'inline.png',
    mimeType: 'image/png',
    buffer: await makePng(page, 300, 100, 'DRAFT')
  })
  await page.getByTestId('composer-save-draft-button').click()
  await expect(composer.status).toHaveAttribute('data-saves', /[1-9]/)
  // Let the pending autosave run, then close this composer: two composers
  // on one draft would destroy each other's versions
  await page.waitForTimeout(2500)
  const draftId = (await composer.status.getAttribute('data-draft-id')) ?? ''
  await page.close()

  const reopenedPage = await (await browser.newContext()).newPage()
  reopenedPage.on('console', message => console.log('BROWSER', message.text()))
  const reopened = new SpikeComposer(reopenedPage)
  await reopened.open(user, `?draft=${draftId}`)
  await expect(reopened.editor.locator('img[data-reference]')).toHaveAttribute('src', /^blob:/)
  await expect
    .poll(() =>
      reopened.editor
        .locator('img[data-reference]')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)
    )
    .toBe(300)
  await reopened.shot('draft-reopened')
  for (const suffix of [' edited', ' again']) {
    await reopened.subject.press('End')
    await reopened.subject.pressSequentially(suffix)
    await reopened.page.getByTestId('composer-save-draft-button').click()
  }
  await expect(reopened.status).toHaveAttribute('data-saves', /^[2-9]$/)
  // The autosave the subject edits scheduled runs after the explicit saves
  await reopened.page.waitForTimeout(2500)
  const lastId = (await reopened.status.getAttribute('data-draft-id')) ?? ''
  const [got] = await jmap.request([
    [
      'Email/get',
      {
        accountId: await jmap.accountId(),
        ids: [lastId],
        // Not ['attachments', 'bodyValues'] alone: tmail-backend 1.0.21.2 fails
        // (ReadLevel.combine, NotImplementedError); with htmlBody first it works
        properties: ['subject', 'htmlBody', 'bodyValues', 'attachments'],
        fetchHTMLBodyValues: true
      },
      'g'
    ]
  ])
  const draft = (got?.[1].list as Record<string, unknown>[])[0] ?? {}
  expect(draft.subject).toBe('Draft with image edited again')
  const attachments = draft.attachments as { cid: string; disposition: string }[]
  expect(attachments).toHaveLength(1)
  expect(attachments[0]?.disposition).toBe('inline')
  const html = Object.values(draft.bodyValues as Record<string, { value: string }>)[0]?.value ?? ''
  expect(html).toContain(`src="cid:${attachments[0]?.cid}"`)
})

test('SPIKE-DRAFT CMP-22 the composer comes back after a reload, images included', async ({
  page,
  user
}) => {
  const composer = await new SpikeComposer(page).open(user)
  await composer.to.fill('someone@example.com')
  await composer.subject.fill('Survives a reload')
  await page.keyboard.press('Tab')
  await composer.editor.click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.type('Body before reload ')
  const chooser = page.waitForEvent('filechooser')
  await composer.button('Insert image').click()
  await (await chooser).setFiles({
    name: 'reload.png',
    mimeType: 'image/png',
    buffer: await makePng(page, 240, 80, 'RELOAD')
  })
  await expect(composer.editor.locator('img[data-reference]')).toHaveCount(1)

  // Basic auth keeps no credentials across a reload: sign in again, same URL
  await page.reload()
  const restored = await new SpikeComposer(page).open(user)
  await expect(restored.status).toHaveText('Composer restored after reload')
  await expect(restored.subject).toHaveValue('Survives a reload')
  await expect(restored.to).toHaveValue('someone@example.com')
  await expect(restored.editor).toContainText('Body before reload')
  await expect
    .poll(() =>
      restored.editor
        .locator('img[data-reference]')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)
    )
    .toBe(240)
  await restored.shot('restored-after-reload')
  const snapshot = await page.evaluate(() => Object.keys(sessionStorage))
  expect(snapshot.some(key => key.startsWith('twake-mail-composer|'))).toBe(true)
})
