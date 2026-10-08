import type { Page } from '@playwright/test'

import {
  ComposerPage,
  ConversationPage,
  EmailPage,
  LoginPage,
  type MailboxPage
} from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { makePng } from '../support/clipboard'
import { expect, test } from '../support/fixtures'
import type { JmapClient, MailboxRole } from '../support/jmap'

/**
 * Reply, reply all, reply to list and forward: the recipients of
 * tmail-flutter's rules (ADR 0064, 0065), the localized prefixes, the quote
 * (atomic, remote content blocked, editable), the files of a forward, and
 * what the recipient really receives (In-Reply-To, References, quote, files).
 */

interface ReceivedPart {
  partId: string | null
  blobId: string | null
  type: string
  name: string | null
  cid: string | null
  disposition: string | null
}

interface Received {
  id: string
  subject: string
  keywords: Record<string, true>
  messageId: string[] | null
  inReplyTo: string[] | null
  references: string[] | null
  to: { email: string }[] | null
  html: string
  text: string
  attachments: ReceivedPart[]
}

/** The emails of a mailbox read in full, newest first */
async function readMailbox(
  jmap: JmapClient,
  role: MailboxRole
): Promise<Received[]> {
  const accountId = await jmap.accountId()
  const mailbox = await jmap.findMailboxByRole(role)
  const [, got] = await jmap.request([
    [
      'Email/query',
      {
        accountId,
        filter: { inMailbox: mailbox.id },
        sort: [{ property: 'receivedAt', isAscending: false }]
      },
      'q'
    ],
    [
      'Email/get',
      {
        accountId,
        '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
        // A body property before attachments (tmail-backend#2686)
        properties: [
          'htmlBody',
          'textBody',
          'bodyValues',
          'attachments',
          'subject',
          'keywords',
          'messageId',
          'inReplyTo',
          'references',
          'to'
        ],
        bodyProperties: [
          'partId',
          'blobId',
          'type',
          'name',
          'cid',
          'disposition'
        ],
        fetchHTMLBodyValues: true,
        fetchTextBodyValues: true
      },
      'g'
    ]
  ])
  const list = (got?.[1].list ?? []) as (Omit<Received, 'html' | 'text'> & {
    htmlBody: ReceivedPart[]
    textBody: ReceivedPart[]
    bodyValues: Record<string, { value: string }>
  })[]
  return list.map(email => ({
    ...email,
    html: email.htmlBody
      .map(part => email.bodyValues[part.partId ?? '']?.value ?? '')
      .join(''),
    text: email.textBody
      .map(part => email.bodyValues[part.partId ?? '']?.value ?? '')
      .join('')
  }))
}

async function waitForReceived(
  jmap: JmapClient,
  subject: string,
  role: MailboxRole = 'inbox'
): Promise<Received> {
  await jmap.waitForEmail({ subject, mailboxRole: role })
  const found = (await readMailbox(jmap, role)).find(
    email => email.subject === subject
  )
  if (!found) throw new Error(`No "${subject}" in ${role}`)
  return found
}

/** Shows the recipient fields of an answer, folded as it opens */
async function unfold(composer: ComposerPage): Promise<void> {
  await composer.recipientsSummary.click()
}

/** The quote of the composer: a frame, in the editor */
function quoteFrame(composer: ComposerPage): ReturnType<Page['frameLocator']> {
  return composer.page.frameLocator(
    '[data-testid="composer"] [data-html-block-view="quote"] iframe'
  )
}

async function openReceived(
  mailbox: MailboxPage,
  subject: string
): Promise<EmailPage> {
  return mailbox.openEmail(subject)
}

async function setSignature(jmap: JmapClient, html: string): Promise<void> {
  const accountId = await jmap.accountId()
  const [identities] = await jmap.request([
    ['Identity/get', { accountId, ids: null }, 'i']
  ])
  const id = (identities?.[1].list as { id: string }[])[0]?.id ?? ''
  await jmap.request([
    [
      'Identity/set',
      { accountId, update: { [id]: { htmlSignature: html } } },
      's'
    ]
  ])
}

test.describe('CMP and EML: replying and forwarding', () => {
  test.use({ emailsOneByOne: true })

  test(
    'EML-14 Reply to an email without Reply-To answers its sender, under a "Re:" subject',
    {
      tag: '@mobile'
    },
    async ({ page, user, jmap }) => {
      await jmap.importEml('reply_email/without-reply-to.eml', 'inbox', {
        replace: { 'bob@example.com': user.email }
      })
      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await openReceived(mailbox, 'Reply email without Reply-To')
      await expect(email.replyAllButton).toBeVisible()
      await expect(email.replyToListButton).toBeHidden()

      const composer = await email.reply()
      await expect(composer.subjectInput).toHaveValue(
        'Re: Reply email without Reply-To'
      )
      await expect(composer.editor).toBeFocused()
      await unfold(composer)
      await expect(composer.recipients('to')).toHaveText(['emma@example.com'])
      await expect(quoteFrame(composer).locator('blockquote')).toContainText(
        'Reply email without Reply-To'
      )
      await expectNoA11yViolations(page)
    }
  )

  test('EML-15 Reply to an email with Reply-To answers the Reply-To address', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.importEml('reply_email/with-reply-to.eml', 'inbox', {
      replace: { 'bob@example.com': user.email }
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (
      await openReceived(mailbox, 'Reply email with Reply-To')
    ).reply()
    await expect(composer.subjectInput).toHaveValue(
      'Re: Reply email with Reply-To'
    )
    await unfold(composer)
    await expect(composer.recipients('to')).toHaveText([
      'emma-reply-to@example.com'
    ])
  })

  test('EML-16 Reply all answers Reply-To and sender, keeps Cc and Bcc, leaves the user out', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.importEml('reply_email/reply-all.eml', 'inbox', {
      replace: { 'bob@example.com': user.email }
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (
      await openReceived(mailbox, 'Reply all email')
    ).replyAll()
    await expect(composer.subjectInput).toHaveValue('Re: Reply all email')
    await unfold(composer)
    await expect(composer.recipients('to')).toHaveText([
      'emma-reply-to@example.com',
      'emma@example.com'
    ])
    await expect(composer.recipients('cc')).toHaveText(['alice'])
    await expect(composer.recipients('bcc')).toHaveText(['brian'])
  })

  test('EML-17 Reply to list answers the List-Post address only', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.importEml('reply_email/reply-to-list.eml', 'inbox', {
      replace: { 'bob@example.com': user.email }
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await openReceived(mailbox, 'Reply to list email')
    await expect(email.replyToListButton).toBeVisible()
    await email.replyToListButton.click()
    const composer = new ComposerPage(page)
    await expect(composer.subjectInput).toHaveValue('Re: Reply to list email')
    await unfold(composer)
    await expect(composer.recipients('to')).toHaveText([
      'emma-reply-to-list@example.com'
    ])
    await expect(composer.recipients('cc')).toHaveCount(0)
  })

  test('CMP-08 a reply to an email the user sent goes to its recipients', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const alice = await users.create({ prefix: 'alice' })
    await jmap.sendEmail({
      to: [user.email, alice.email],
      subject: 'reply own sent email',
      text: 'Sent by me'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'sent' })
    const composer = await (
      await openReceived(mailbox, 'reply own sent email')
    ).reply()
    await unfold(composer)
    await expect(composer.recipients('to')).toHaveText([
      user.email,
      alice.email
    ])
  })

  test('CMP-13 a forward quotes the fields of the email and has no recipient', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.importEml('forward_email/forward.eml', 'inbox', {
      replace: { 'bob@example.com': user.email }
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (
      await openReceived(mailbox, 'Forward email')
    ).forward()
    await expect(composer.subjectInput).toHaveValue('Fwd: Forward email')
    await expect(composer.recipientInput('to')).toBeFocused()
    await expect(composer.recipients('to')).toHaveCount(0)
    const header = quoteFrame(composer).locator('cite')
    await expect(header).toContainText('------- Forwarded message -------')
    for (const label of ['Subject:', 'Date:', 'From:', 'To:', 'Cc:', 'Bcc:']) {
      await expect(header).toContainText(label)
    }
    await expectNoA11yViolations(page)
  })

  test('EML-22 a forward carries the files of the email, which can be removed', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    await jmap.sendEmail({
      to: user.email,
      subject: 'Two files',
      text: 'See attached',
      attachments: [
        { name: 'file1.txt', type: 'text/plain', content: 'first' },
        { name: 'file2.txt', type: 'text/plain', content: 'second' }
      ]
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await openReceived(mailbox, 'Two files')

    let composer = await email.forward()
    await expect(composer.attachments).toHaveText([/file1\.txt/, /file2\.txt/])
    await composer.fill({ to: [bob.email] })
    await composer.send()

    composer = await email.forward()
    await composer.subjectInput.fill('Fwd: Only file1')
    await composer.root
      .getByRole('button', { name: 'Remove file2.txt' })
      .click()
    await expect(composer.attachments).toHaveText([/file1\.txt/])
    await composer.fill({ to: [bob.email] })
    await composer.send()

    const bobJmap = jmapFor(bob)
    const both = await waitForReceived(bobJmap, 'Fwd: Two files')
    expect(both.attachments.map(part => part.name)).toEqual([
      'file1.txt',
      'file2.txt'
    ])
    expect(both.inReplyTo).toBe(null)
    const one = await waitForReceived(bobJmap, 'Fwd: Only file1')
    expect(one.attachments.map(part => part.name)).toEqual(['file1.txt'])
    // The original keeps its files, and is marked forwarded
    await expect(email.attachments).toHaveCount(2)
    const [original] = (await readMailbox(jmap, 'inbox')).filter(
      item => item.subject === 'Two files'
    )
    expect(original?.keywords.$forwarded).toBe(true)
  })

  test(
    'CMP-60 an answer to an email received on an alias goes out from the alias identity',
    { tag: '@mobile' },
    async ({ page, user, users, jmap, jmapFor }) => {
      const bob = await users.create({ prefix: 'bob' })
      // James gives the account an identity of each of its aliases
      const alias = await users.createAlias(user, 'sales')
      await jmapFor(bob).sendEmail({
        to: alias,
        subject: 'Quote request',
        text: 'How much?'
      })
      await jmap.waitForEmail({ subject: 'Quote request' })
      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await openReceived(mailbox, 'Quote request')

      const composer = await email.reply()
      await expect(composer.identitySelect).toContainText(alias)
      await expectNoA11yViolations(page)
      await composer.send()

      const reply = await jmapFor(bob).waitForEmail({
        subject: 'Re: Quote request'
      })
      expect(reply.from?.[0]?.email).toBe(alias)
    }
  )

  test('CMP-42 a reply is received with In-Reply-To, References and a faithful quote; the email is marked answered', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const bobJmap = jmapFor(bob)
    await bobJmap.sendEmail({
      to: user.email,
      subject: 'Lunch plans',
      html: '<p>Shall we meet at <b>noon</b>?</p><table><tr><td>Cell</td></tr></table>'
    })
    const original = await waitForReceived(jmap, 'Lunch plans')
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (await openReceived(mailbox, 'Lunch plans')).reply()
    await expect(composer.editor).toBeFocused()
    await page.keyboard.type('Noon is fine.')
    await composer.send()

    const received = await waitForReceived(bobJmap, 'Re: Lunch plans')
    expect(received.inReplyTo).toEqual(original?.messageId)
    expect(received.references).toEqual(original?.messageId)
    expect(received.html).toContain('<div>Noon is fine.</div>')
    expect(received.html).toMatch(/<cite[^>]*>On .*, from &lt;/)
    expect(received.html).toContain('<b>noon</b>')
    expect(received.html).toContain('<td>Cell</td>')
    expect(received.text).toContain('> Shall we meet at noon?')
    await expect
      .poll(
        async () =>
          (await readMailbox(jmap, 'inbox')).find(
            email => email.subject === 'Lunch plans'
          )?.keywords.$answered
      )
      .toBe(true)
  })
})

test.describe('CMP: the quote', () => {
  test.use({ emailsOneByOne: true })

  test('CMP-09 a reply to an email with a base64 and a cid image sends both as cid parts', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.importEml('reply_email_with_image_base64/0.eml', 'inbox', {
      replace: { 'alice@example.com': user.email }
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (
      await openReceived(mailbox, 'Mail with base64')
    ).reply()
    await composer.send()

    const reply = await waitForReceived(jmap, 'Re: Mail with base64')
    expect(reply.html.match(/src="cid:/g)).toHaveLength(2)
    expect(reply.html).not.toContain('data:image')
    expect(
      reply.attachments.filter(part => part.disposition === 'inline')
    ).toHaveLength(2)
  })

  test('CMP-38 the remote content of the quote is blocked, without referrer, but sent', async ({
    page,
    user,
    users,
    jmapFor,
    jmap
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    await jmapFor(bob).sendEmail({
      to: user.email,
      subject: 'Tracked newsletter',
      html: '<p>Hello</p><img src="https://remote.example/pixel.png" alt="pixel"><div style="background:url(https://remote.example/bg.png)">Background</div>'
    })
    const remote: string[] = []
    await page.route('https://remote.example/**', async route => {
      remote.push(route.request().url())
      await route.fulfill({ status: 204 })
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const received = await openReceived(mailbox, 'Tracked newsletter')
    // Bob is of the domain of the user: the reading view shows his remote
    // images. The composer must load none
    await page.waitForTimeout(500)
    remote.length = 0
    const composer = await received.forward()
    await expect(quoteFrame(composer).locator('blockquote')).toContainText(
      'Background'
    )
    // Editing the quote keeps the remote image without loading it
    await composer.root.getByTestId('html-block-edit-quote').click()
    await expect(composer.editor.locator('img[data-blocked-src]')).toHaveCount(
      1
    )
    await page.waitForTimeout(500)
    expect(remote).toEqual([])

    await composer.fill({ to: [user.email] })
    await composer.send()
    const sent = await waitForReceived(jmap, 'Fwd: Tracked newsletter')
    expect(sent.html).toContain('src="https://remote.example/pixel.png"')
    expect(remote).toEqual([])
  })

  test('CMP-39 "Edit the quoted message" is reached with Tab and turns the quote into text', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.importEml('spike_composer/newsletter.eml', 'inbox', {
      replace: { 'reader@example.com': user.email }
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (
      await openReceived(mailbox, 'ACME Weekly newsletter')
    ).reply()
    await expect(composer.editor).toBeFocused()
    await page.keyboard.press('Tab')
    const edit = composer.root.getByRole('button', {
      name: 'Edit the quoted message'
    })
    await expect(edit).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      composer.root.locator('[data-html-block-view="quote"]')
    ).toHaveCount(0)
    await expect(composer.editor).toContainText(
      'The ACME Weekly, October edition'
    )
    // The cid logo of the newsletter shows in the text
    await expect(
      composer.editor.locator('img[data-reference="logo@newsletter"]')
    ).toHaveAttribute('src', /^blob:/)
  })

  test('CMP-40 a reply saved as a draft reopens with its quote, and is sent in the thread, the original answered', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const bobJmap = jmapFor(bob)
    await bobJmap.sendEmail({
      to: user.email,
      subject: 'Draft me',
      html: '<p>Original text</p>'
    })
    await page.clock.install()
    const mailbox = await new LoginPage(page).loginAs(user)
    let composer = await (await openReceived(mailbox, 'Draft me')).reply()
    await expect(composer.editor).toBeFocused()
    await page.keyboard.type('Answer kept')
    await composer.idle()
    await expect(composer.saveStatus).toHaveText('Draft saved', {
      timeout: 10_000
    })
    await composer.close()
    await expect(composer.root).toBeHidden()

    await mailbox.openFolder({ role: 'drafts' })
    await mailbox.emailRowLink('Re: Draft me').click()
    composer = new ComposerPage(page)
    await expect(composer.subjectInput).toHaveValue('Re: Draft me')
    await expect(quoteFrame(composer).locator('blockquote')).toContainText(
      'Original text'
    )
    await expect(composer.editor).toContainText('Answer kept')
    await composer.send()

    const received = await waitForReceived(bobJmap, 'Re: Draft me')
    const [original] = await readMailbox(bobJmap, 'sent')
    expect(received.inReplyTo).toEqual(original?.messageId)
    expect(received.html).toContain('Original text')
    // The draft kept the email it answers (X-Twake-Answering), the message
    // sent does not carry it
    await expect
      .poll(async () => {
        const [answered] = await readMailbox(jmap, 'inbox')
        return answered?.keywords
      })
      .toMatchObject({ $answered: true })
    const accountId = await bobJmap.accountId()
    const [headers] = await bobJmap.request([
      [
        'Email/get',
        {
          accountId,
          ids: [received.id],
          properties: ['header:X-Twake-Answering:asText']
        },
        'h'
      ]
    ])
    expect(headers?.[1].list).toEqual([
      expect.objectContaining({ 'header:X-Twake-Answering:asText': null })
    ])
  })

  test('CMP-41 the quote of a newsletter keeps its tables, images, links and styles', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.importEml('spike_composer/newsletter.eml', 'inbox', {
      replace: { 'reader@example.com': user.email }
    })
    const [original] = await readMailbox(jmap, 'inbox')
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (
      await openReceived(mailbox, 'ACME Weekly newsletter')
    ).forward()
    await composer.fill({ to: [user.email] })
    await composer.send()

    const sent = await waitForReceived(jmap, 'Fwd: ACME Weekly newsletter')
    const count = (html: string) =>
      page.evaluate(source => {
        const body = new DOMParser().parseFromString(source, 'text/html').body
        const quote =
          body.querySelector('[data-html-block="quote"] > blockquote') ?? body
        return {
          tables: quote.querySelectorAll('table').length,
          images: quote.querySelectorAll('img').length,
          links: quote.querySelectorAll('a[href]').length
        }
      }, html)
    expect(await count(sent.html)).toEqual(await count(original?.html ?? ''))
    expect(sent.html).toContain('src="cid:logo@newsletter"')
    // The styles of the newsletter only apply to the quote
    expect(sent.html).toContain('[data-html-block="quote"] .heading')
  })
})

test.describe('CMP: images of an answer (CMP-10 to CMP-12)', () => {
  test.use({ emailsOneByOne: true })

  async function openReply(
    page: Page,
    user: { email: string; password: string },
    jmap: JmapClient
  ): Promise<ComposerPage> {
    await jmap.importEml('reply_email/reply-all.eml', 'inbox', {
      replace: { 'bob@example.com': user.email }
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await (
      await openReceived(mailbox, 'Reply all email')
    ).reply()
    await expect(
      composer.root.locator('[data-html-block-view="quote"] iframe')
    ).toBeVisible()
    return composer
  }

  test('CMP-10 an image inserted before the editor was touched goes on the first line', async ({
    page,
    user,
    jmap
  }) => {
    await setSignature(jmap, '<p>SIGNATURE_MARKER <b>Alice</b></p>')
    const composer = await openReply(page, user, jmap)
    await composer.insertImage({
      name: 'first.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 200, 80, 'IMG')
    })
    const html = await composer.editorHtml()
    expect(html.indexOf('first.png')).toBeLessThan(
      html.indexOf('SIGNATURE_MARKER')
    )
    expect(html.indexOf('SIGNATURE_MARKER')).toBeLessThan(
      html.indexOf('data-html-block-view="quote"')
    )
  })

  test('CMP-11 without signature, an image at the caret above the quote goes before it', async ({
    page,
    user,
    jmap
  }) => {
    const composer = await openReply(page, user, jmap)
    await composer.root.locator('[data-html-block-view="quote"]').click()
    await page.keyboard.press('ArrowLeft')
    await composer.insertImage({
      name: 'above.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 200, 80, 'IMG')
    })
    // The image is found by its reference: its alt is empty, not the name of its file (#159)
    const html = await composer.editorHtml()
    expect(html.indexOf('data-reference=')).toBeGreaterThan(-1)
    expect(html.indexOf('data-reference=')).toBeLessThan(
      html.indexOf('data-html-block-view="quote"')
    )
  })

  test('CMP-12 with a signature, an image at the caret above the quote goes between them', async ({
    page,
    user,
    jmap
  }) => {
    await setSignature(jmap, '<p>SIGNATURE_MARKER</p>')
    const composer = await openReply(page, user, jmap)
    await composer.placeCaretAboveQuote()
    await composer.insertImage({
      name: 'between.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 200, 80, 'IMG')
    })
    const html = await composer.editorHtml()
    expect(html.indexOf('SIGNATURE_MARKER')).toBeLessThan(
      html.indexOf('data-reference=')
    )
    expect(html.indexOf('data-reference=')).toBeLessThan(
      html.indexOf('data-html-block-view="quote"')
    )
  })
})

const PREFIXES = [
  { lang: 'en', reply: 'Re:', forward: 'Fwd:' },
  { lang: 'fr', reply: 'Re:', forward: 'Tr:' },
  { lang: 'ru', reply: 'Re:', forward: 'Fwd:' },
  { lang: 'vi', reply: 'Re:', forward: 'Chuyển tiếp:' }
] as const

test.describe('EML-18 to EML-21 the prefixes follow the language, once', () => {
  test.use({ emailsOneByOne: true })

  for (const { lang, reply, forward } of PREFIXES) {
    test(`EML-18 EML-19 EML-20 EML-21 in ${lang}`, async ({
      page,
      user,
      jmap
    }) => {
      await page.addInitScript(language => {
        window.localStorage.setItem('lang', language)
      }, lang)
      await jmap.sendEmail({ to: user.email, subject: 'Prefixes', text: 'x' })
      await jmap.sendEmail({
        to: user.email,
        subject: `${reply} Already answered`,
        text: 'x'
      })
      await jmap.sendEmail({
        to: user.email,
        subject: `${forward} Already forwarded`,
        text: 'x'
      })
      const mailbox = await new LoginPage(page).loginAs(user)

      const cases = [
        ['Prefixes', 'reply', `${reply} Prefixes`],
        ['Prefixes', 'forward', `${forward} Prefixes`],
        [`${reply} Already answered`, 'reply', `${reply} Already answered`],
        [
          `${forward} Already forwarded`,
          'forward',
          `${forward} Already forwarded`
        ]
      ] as const
      for (const [subject, action, expected] of cases) {
        const email = await openReceived(mailbox, subject)
        const composer =
          action === 'reply' ? await email.reply() : await email.forward()
        await expect(composer.subjectInput).toHaveValue(expected)
        await composer.close()
        await expect(composer.root).toBeHidden()
        await email.back()
      }
    })
  }
})

test.describe('KBD and menus: answering', () => {
  test('KBD-03 r, Shift+R and f answer the open email; the row menu replies too', async ({
    page,
    user,
    users,
    jmapFor
  }) => {
    const carol = await users.create({ prefix: 'carol' })
    await jmapFor(carol).sendEmail({
      to: [user.email, 'dave@example.com'],
      subject: 'Shortcuts',
      text: 'x'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'inbox' })

    const menu = await mailbox.openEmailMenu('Shortcuts', { rightClick: true })
    await menu.getByTestId('email-action-forward').click()
    let composer = new ComposerPage(page)
    await expect(composer.subjectInput).toHaveValue('Fwd: Shortcuts')
    await composer.close()
    await expect(composer.root).toBeHidden()

    // In the conversation (on by default), the open email
    await mailbox.emailRow('Shortcuts').click()
    const conversation = new ConversationPage(page)
    await conversation.expectLoaded('Shortcuts')
    for (const [key, subject] of [
      ['r', 'Re: Shortcuts'],
      ['Shift+R', 'Re: Shortcuts'],
      ['f', 'Fwd: Shortcuts']
    ] as const) {
      await conversation.subject.focus()
      await page.keyboard.press(key)
      composer = new ComposerPage(page)
      await expect(composer.subjectInput).toHaveValue(subject)
      if (key === 'Shift+R') {
        await unfold(composer)
        await expect(composer.recipients('to')).toHaveText([
          carol.email,
          'dave@example.com'
        ])
      }
      await composer.close()
      await expect(composer.root).toBeHidden()
    }
    // The buttons of a message of the conversation
    await conversation.root.getByTestId('reply-email-button').first().click()
    await expect(new ComposerPage(page).subjectInput).toHaveValue(
      'Re: Shortcuts'
    )
    await expectNoA11yViolations(page)
  })

  test('KBD-04 Caps Lock R replies, a second reply brings back the first, keys typed while it opens are its own', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const carol = await users.create({ prefix: 'carol' })
    await jmapFor(carol).sendEmail({
      to: [user.email, 'dave@example.com'],
      subject: 'Caps',
      text: 'x'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'inbox' })
    await mailbox.emailRow('Caps').click()
    const conversation = new ConversationPage(page)
    await conversation.expectLoaded('Caps')

    // Caps Lock on: "R" without Shift is no Shift+R
    await conversation.subject.focus()
    await page.keyboard.press('R')
    const composer = new ComposerPage(page)
    await expect(composer.subjectInput).toHaveValue('Re: Caps')
    await unfold(composer)
    await expect(composer.recipients('to')).toHaveText([carol.email])

    // Replying again brings back the reply open
    await conversation.subject.focus()
    await page.keyboard.press('r')
    await expect(page.getByTestId('composer')).toHaveCount(1)
    await expect(composer.editor).toBeFocused()
    await composer.close()
    await expect(composer.root).toBeHidden()

    // The email answered loads slowly: "e" typed meanwhile archives nothing
    await page.route('**/jmap', async route => {
      if ((route.request().postData() ?? '').includes('"messageId"')) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      await route.continue()
    })
    await conversation.subject.focus()
    await page.keyboard.press('f')
    await page.keyboard.press('e')
    await expect(composer.subjectInput).toHaveValue('Fwd: Caps')
    const inbox = await jmap.findMailboxByRole('inbox')
    const [email] = await jmap.queryEmails({ inMailbox: inbox.id })
    expect(email).toBeDefined()
    await expect(conversation.subject).toBeVisible()
    await page.unroute('**/jmap')
  })
})
