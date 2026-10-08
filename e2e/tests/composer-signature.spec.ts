import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { dropPng, makePng } from '../support/clipboard'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

/** Two identities: the default one with an HTML signature, "Work" with a text one */
async function setUpIdentities(jmap: JmapClient, email: string): Promise<void> {
  const accountId = await jmap.accountId()
  const [identities] = await jmap.request([
    ['Identity/get', { accountId, ids: null }, 'i']
  ])
  const defaultId = (identities?.[1].list as { id: string }[])[0]?.id ?? ''
  await jmap.request([
    [
      'Identity/set',
      {
        accountId,
        update: {
          [defaultId]: {
            htmlSignature:
              '<p>SIGNATURE_MARKER <b>Alice</b></p><style>body { display: none }</style><img src="x" onerror="alert(1)">'
          }
        },
        create: {
          work: {
            name: 'Work',
            email,
            textSignature: 'WORK_SIGNATURE\nACME <sales>'
          }
        }
      },
      's'
    ]
  ])
}

async function readSentHtml(
  jmap: JmapClient,
  subject: string
): Promise<string> {
  const email = await jmap.waitForEmail({ subject })
  const [got] = await jmap.request([
    [
      'Email/get',
      {
        accountId: await jmap.accountId(),
        ids: [email.id],
        properties: ['htmlBody', 'bodyValues'],
        fetchHTMLBodyValues: true
      },
      'g'
    ]
  ])
  const found = (
    got?.[1].list as {
      htmlBody: { partId: string }[]
      bodyValues: Record<string, { value: string }>
    }[]
  )[0]
  return (found?.htmlBody ?? [])
    .map(part => found?.bodyValues[part.partId]?.value ?? '')
    .join('')
}

test.describe('CMP: signatures and images', () => {
  test.use({ emailsOneByOne: true })

  test('CMP-43 the signature of the identity, sanitized, goes above the quote; another identity replaces it', async ({
    page,
    user,
    jmap
  }) => {
    await setUpIdentities(jmap, user.email)
    await jmap.importEml('reply_email/reply-all.eml', 'inbox', {
      replace: { 'bob@example.com': user.email }
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (await mailbox.openEmail('Reply all email')).reply()
    await expect(composer.editor).toBeFocused()
    let html = await composer.editorHtml()
    expect(html).toContain('SIGNATURE_MARKER')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<style')
    expect(html.indexOf('SIGNATURE_MARKER')).toBeLessThan(
      html.indexOf('data-html-block-view="quote"')
    )

    await page.keyboard.type('Body text')
    await composer.chooseIdentity('Work')
    html = await composer.editorHtml()
    expect(html).not.toContain('SIGNATURE_MARKER')
    expect(html).toContain('WORK_SIGNATURE<br>ACME &lt;sales&gt;')
    expect(html.indexOf('Body text')).toBeLessThan(
      html.indexOf('WORK_SIGNATURE')
    )
    expect(html.indexOf('WORK_SIGNATURE')).toBeLessThan(
      html.indexOf('data-html-block-view="quote"')
    )
    await expectNoA11yViolations(page)

    await composer.recipientsSummary.click()
    await composer.recipientInput('to').fill(user.email)
    await composer.recipientInput('to').press('Enter')
    await composer.send()
    const sent = await readSentHtml(jmap, 'Re: Reply all email')
    // tmail-flutter finds the signature by its class
    expect(sent).toMatch(
      /<div data-html-block="signature"[^>]*class="tmail-signature"[^>]*>.*WORK_SIGNATURE/
    )
    expect(sent.indexOf('WORK_SIGNATURE')).toBeLessThan(
      sent.indexOf('<blockquote')
    )
  })

  test('CMP-44 an image dropped on the text goes inline where it is dropped; on the rest of the body it is attached, elsewhere ignored', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({
      to: [user.email],
      subject: 'Dropped image',
      body: 'Above the image'
    })
    const png = await makePng(page, 120, 60, 'DROP')

    await dropPng(composer.editor, png, 'inline.png')
    await expect(composer.editor.locator('img[data-reference]')).toHaveCount(1)
    await expect(composer.attachments).toHaveCount(0)

    // Dropped on the subject: nothing, as tmail-flutter only the body
    // takes files
    await dropPng(composer.subjectInput, png, 'ignored.png')
    await expect(composer.attachments).toHaveCount(0)

    // The same image dropped on the body out of the text is attached
    await dropPng(
      composer.root.getByTestId('composer-drop-zone'),
      png,
      'attached.png'
    )
    await expect(composer.attachments).toHaveText([/attached\.png/])
    await expect(composer.attachments.first()).toHaveAttribute(
      'data-status',
      'done',
      { timeout: 20_000 }
    )

    await composer.send()
    const html = await readSentHtml(jmap, 'Dropped image')
    expect(html.match(/src="cid:/g)).toHaveLength(1)
  })

  test('CMP-45 an inline image is resized with the mouse, by its corner handle', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ to: [user.email], subject: 'Resized', body: 'x' })
    await composer.insertImage({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 400, 200, 'BIG')
    })
    const image = composer.editor.locator('img[data-reference]')
    await image.click()
    const handle = composer.editor.locator(
      '[data-resize-handle="bottom-right"]'
    )
    await expect(handle).toBeVisible()
    const box = await handle.boundingBox()
    if (!box) throw new Error('no resize handle')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x - 200, box.y - 100, { steps: 10 })
    await page.mouse.up()
    await expect
      .poll(async () => Number(await image.getAttribute('width')))
      .toBeLessThan(300)
    await expectNoA11yViolations(page)
  })
})
