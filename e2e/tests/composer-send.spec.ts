import { ComposerPage, EmailPage, LoginPage, type MailboxPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { makePng } from '../support/clipboard'
import { keptComposers } from '../support/composerStorage'
import { expect, test } from '../support/fixtures'
import type { JmapClient, MailboxRole } from '../support/jmap'

/** A 1 × 1 transparent PNG */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

interface BodyPart {
  partId?: string | null
  blobId?: string | null
  type: string
  name?: string | null
  cid?: string | null
  disposition?: string | null
  subParts?: BodyPart[] | null
}

interface ReadEmail {
  id: string
  subject: string
  mailboxIds: Record<string, true>
  keywords: Record<string, true>
  to?: { email: string }[]
  replyTo?: { email: string }[] | null
  bodyStructure: BodyPart
  htmlBody: BodyPart[]
  textBody: BodyPart[]
  attachments: BodyPart[]
  bodyValues: Record<string, { value: string }>
  'header:X-JMAP-Identity:asText'?: string | null
}

/**
 * Emails of a mailbox read in full. A body property comes first: past
 * `attachments`, tmail-backend answers serverFail otherwise (#2686).
 */
async function readMailbox(
  jmap: JmapClient,
  role: MailboxRole
): Promise<ReadEmail[]> {
  const accountId = await jmap.accountId()
  const mailbox = await jmap.findMailboxByRole(role)
  const [, got] = await jmap.request([
    ['Email/query', { accountId, filter: { inMailbox: mailbox.id } }, 'q'],
    [
      'Email/get',
      {
        accountId,
        '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
        properties: [
          'htmlBody',
          'textBody',
          'bodyValues',
          'attachments',
          'bodyStructure',
          'subject',
          'mailboxIds',
          'keywords',
          'to',
          'replyTo',
          'header:X-JMAP-Identity:asText'
        ],
        bodyProperties: [
          'partId',
          'blobId',
          'type',
          'name',
          'cid',
          'disposition',
          'subParts'
        ],
        fetchHTMLBodyValues: true,
        fetchTextBodyValues: true
      },
      'g'
    ]
  ])
  return (got?.[1].list ?? []) as ReadEmail[]
}

async function emailState(jmap: JmapClient): Promise<string> {
  const accountId = await jmap.accountId()
  const [got] = await jmap.request([
    ['Email/get', { accountId, ids: [], properties: ['id'] }, 'g']
  ])
  return String(got?.[1].state)
}

/** What changed since `state`, without Email/query */
async function emailChanges(
  jmap: JmapClient,
  state: string
): Promise<{ created: string[]; destroyed: string[] }> {
  const accountId = await jmap.accountId()
  const [changes] = await jmap.request([
    ['Email/changes', { accountId, sinceState: state }, 'c']
  ])
  const result = changes?.[1] as { created: string[]; destroyed: string[] }
  return { created: result.created, destroyed: result.destroyed }
}

async function subjectsOf(
  jmap: JmapClient,
  ids: readonly string[]
): Promise<string[]> {
  const accountId = await jmap.accountId()
  const [got] = await jmap.request([
    ['Email/get', { accountId, ids, properties: ['subject'] }, 'g']
  ])
  return ((got?.[1].list ?? []) as { subject: string }[]).map(
    email => email.subject
  )
}

function bodyOf(email: ReadEmail, parts: BodyPart[]): string {
  return parts
    .map(part => email.bodyValues[part.partId ?? '']?.value ?? '')
    .join('')
}

function types(part: BodyPart): string[] {
  return [part.type, ...(part.subParts ?? []).flatMap(types)]
}

async function openDraft(
  mailbox: MailboxPage,
  subject: string
): Promise<ComposerPage> {
  await mailbox.openFolder({ role: 'drafts' })
  await mailbox.emailRowLink(subject).click()
  const composer = new ComposerPage(mailbox.page)
  await expect(composer.subjectInput).toHaveValue(subject)
  return composer
}

/** Sets up two identities, the first one the default (lowest sortOrder) */
async function setUpIdentities(jmap: JmapClient, email: string): Promise<void> {
  const accountId = await jmap.accountId()
  await jmap.request([
    [
      'Identity/set',
      {
        accountId,
        create: {
          first: { name: 'Identity 1', email, sortOrder: 0 },
          second: { name: 'Identity 2', email, sortOrder: 1 }
        }
      },
      's'
    ]
  ])
}

test.describe('CMP composer: sending, drafts and attachments', () => {
  test('CMP-01 a message to two people, an inline image and a file, is received as written and filed in Sent', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const alice = await users.create({ prefix: 'alice' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({
      to: [bob.email, alice.email],
      subject: 'Test subject'
    })
    await composer.editor.click()
    await page.keyboard.type('Hello ')
    await page.keyboard.press('Control+B')
    await page.keyboard.type('both')
    await page.keyboard.press('Control+B')
    await page.keyboard.press('Enter')
    await composer.insertImage({
      name: 'inline.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 240, 120, 'INLINE')
    })
    await composer.attachFile({
      name: 'report.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 120, 60, 'FILE')
    })
    await expectNoA11yViolations(page)

    await composer.send()

    await expect(mailbox.toast).toContainText(
      'Message has been sent successfully'
    )
    for (const reader of [bob, alice]) {
      const readerJmap = jmapFor(reader)
      await readerJmap.waitForEmail({ subject: 'Test subject' })
      const [received] = await readMailbox(readerJmap, 'inbox')
      if (!received) throw new Error('Not received')
      expect(types(received.bodyStructure)).toEqual(
        expect.arrayContaining([
          'multipart/related',
          'multipart/alternative',
          'text/plain',
          'text/html'
        ])
      )
      const html = bodyOf(received, received.htmlBody)
      expect(html).toContain('<div>Hello <strong>both</strong></div>')
      const inline = received.attachments.find(
        part => part.disposition === 'inline'
      )
      expect(inline?.cid).toBeTruthy()
      expect(html).toContain(
        `src="cid:${(inline?.cid ?? '').replace(/^<|>$/g, '')}"`
      )
      expect(bodyOf(received, received.textBody)).toContain('Hello both')
      expect(received.attachments.map(part => part.name)).toContain(
        'report.png'
      )
    }
    const [sent] = await readMailbox(jmap, 'sent')
    expect(sent?.subject).toBe('Test subject')
    expect(Object.keys(sent?.keywords ?? {})).toEqual(['$seen'])
    expect(await readMailbox(jmap, 'drafts')).toEqual([])
  })

  test('CMP-07 attachments and inline images: a PNG as a file, the same inline, then two more files', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    const png = {
      name: 'picture.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 160, 80, 'PNG')
    }

    await composer.attachFile(png)
    await expect(composer.attachments.first()).toContainText('picture.png')
    await composer.editor.click()
    await composer.insertImage(png)
    expect(await composer.editorHtml()).toMatch(/<img[^>]*data-reference=/)
    await composer.attachFile(png)
    await composer.attachFile(png)

    await expect(composer.attachments).toHaveCount(3)
    await expect(
      composer.root.getByRole('list', { name: 'Attachments (3)' })
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test(
    'CMP-14 a draft saved on closing reopens from Drafts without a Reply-To field',
    {
      tag: '@mobile'
    },
    async ({ page, user, jmap }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.fill({
        to: [user.email],
        subject: 'Save draft email without Reply-To'
      })

      await composer.closeAnd('save')
      await expect(mailbox.toast).toContainText('Draft saved')

      const reopened = await openDraft(
        mailbox,
        'Save draft email without Reply-To'
      )
      await expect(reopened.recipients('to')).toHaveText([user.email])
      await expect(reopened.recipientInput('reply-to')).toBeHidden()
      expect(
        (await readMailbox(jmap, 'drafts')).map(draft => draft.replyTo ?? null)
      ).toEqual([null])
    }
  )

  test('CMP-15 a reopened draft, its subject changed, is saved again on closing', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ to: [user.email], subject: 'Draft to update' })
    await composer.closeAnd('save')
    await expect(mailbox.toast).toContainText('Draft saved')

    const reopened = await openDraft(mailbox, 'Draft to update')
    await reopened.subjectInput.fill('Draft updated')
    await reopened.closeAnd('save')

    await expect(mailbox.toast).toContainText('Draft saved')
    await expect
      .poll(async () =>
        (await readMailbox(jmap, 'drafts')).map(draft => draft.subject)
      )
      .toEqual(['Draft updated'])
  })

  test('CMP-16 the identity chosen for a draft comes back with it', async ({
    page,
    user,
    jmap
  }) => {
    await setUpIdentities(jmap, user.email)
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.showIdentity()
    await expect(composer.identitySelect).toContainText('Identity 1')
    await composer.fill({ to: [user.email], subject: 'Draft with identity 2' })
    await composer.chooseIdentity('Identity 2')
    await composer.runMoreAction('save-draft')
    await expect(mailbox.toast).toContainText('Draft saved')
    await composer.close()
    await expect(composer.root).toBeHidden()

    const reopened = await openDraft(mailbox, 'Draft with identity 2')
    await expect(reopened.identitySelect).toContainText('Identity 2')
  })

  test('CMP-17 a draft with a file, reopened, is saved again twice', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ to: [user.email], subject: 'Draft with a file' })
    await composer.attachFile({
      name: 'kept.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 120, 60, 'KEPT')
    })
    await composer.closeAnd('save')
    await expect(mailbox.toast).toContainText('Draft saved')

    const reopened = await openDraft(mailbox, 'Draft with a file')
    await expect(reopened.attachments).toHaveText([/kept\.png/])
    for (const suffix of [' edited', ' again']) {
      await reopened.subjectInput.press('End')
      await reopened.subjectInput.pressSequentially(suffix)
      await reopened.runMoreAction('save-draft')
      await expect(mailbox.toast).toContainText('Draft saved')
    }
    await expect
      .poll(async () =>
        (await readMailbox(jmap, 'drafts')).map(draft => draft.subject)
      )
      .toEqual(['Draft with a file edited again'])
    const [draft] = await readMailbox(jmap, 'drafts')
    expect(draft?.attachments.map(part => part.name)).toEqual(['kept.png'])
  })

  test('CMP-18 a draft with an inline image, reopened, shows it and is saved again twice', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ to: [user.email], subject: 'Draft with an image' })
    await composer.editor.click()
    await composer.insertImage({
      name: 'inline.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 200, 100, 'INLINE')
    })
    await composer.closeAnd('save')
    await expect(mailbox.toast).toContainText('Draft saved')

    const reopened = await openDraft(mailbox, 'Draft with an image')
    const image = reopened.editor.locator('img[data-reference]')
    await expect(image).toHaveCount(1)
    await expect
      .poll(() =>
        image.evaluate(element => (element as HTMLImageElement).naturalWidth)
      )
      .toBe(200)
    for (const suffix of [' edited', ' again']) {
      await reopened.subjectInput.press('End')
      await reopened.subjectInput.pressSequentially(suffix)
      await reopened.runMoreAction('save-draft')
      await expect(mailbox.toast).toContainText('Draft saved')
    }
    await expect
      .poll(async () =>
        (await readMailbox(jmap, 'drafts')).map(draft => draft.subject)
      )
      .toEqual(['Draft with an image edited again'])
    const [draft] = await readMailbox(jmap, 'drafts')
    const inline = draft?.attachments.find(
      part => part.disposition === 'inline'
    )
    expect(bodyOf(draft as ReadEmail, draft?.htmlBody ?? [])).toContain(
      `cid:${(inline?.cid ?? '').replace(/^<|>$/g, '')}`
    )
  })

  test('CMP-22 a composer comes back after a reload, until it is closed', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({
      to: ['kept@example.com'],
      subject: 'Kept across a reload',
      body: 'Text kept'
    })
    // Kept in the browser as the user types, no need to wait for the unload
    await expect
      .poll(async () => (await keptComposers(page)).map(kept => kept.subject))
      .toEqual(['Kept across a reload'])

    await page.reload()
    await new LoginPage(page).loginAs(user)

    const restored = new ComposerPage(page)
    await expect(restored.subjectInput).toHaveValue('Kept across a reload')
    await expect(restored.editor).toContainText('Text kept')
    expect(await keptComposers(page)).toHaveLength(1)
    await restored.recipientsSummary
      .or(restored.recipientInput('to'))
      .first()
      .waitFor()
    await expect(restored.root).toContainText('kept@example.com')

    await restored.close()
    const dialog = page.getByTestId('confirm-dialog')
    if (await dialog.isVisible())
      await page.getByTestId('confirm-dialog-alternative-button').click()
    await expect(restored.root).toBeHidden()
    await expect.poll(async () => keptComposers(page)).toEqual([])
  })

  test.describe('an answer back after a reload', () => {
    test.use({ emailsOneByOne: true })

    test(
      'CMP-50 a saved answer comes back on its text, the recipients folded; a new message in To',
      { tag: '@mobile' },
      async ({ page, user, users, jmapFor }) => {
        const bob = await users.create({ prefix: 'bob' })
        await jmapFor(bob).sendEmail({
          to: user.email,
          subject: 'Plans',
          text: 'hello'
        })
        await page.clock.install()
        const mailbox = await new LoginPage(page).loginAs(user)
        const answer = await (await mailbox.openEmail('Plans')).reply()
        await expect(answer.editor).toBeFocused()
        await page.keyboard.type('Answer started')
        await answer.idle()
        await expect(answer.saveStatus).toHaveText('Draft saved', {
          timeout: 10_000
        })
        // The browser keeps the id of the draft a moment later
        await page.clock.runFor(1000)

        await page.reload()
        await new LoginPage(page).loginAs(user)

        const restored = new ComposerPage(page)
        await expect(restored.subjectInput).toHaveValue('Re: Plans')
        await expect(restored.editor).toContainText('Answer started')
        await expect(restored.editor).toBeFocused()
        await expect(restored.recipientsSummary).toBeVisible()
        await expect(restored.recipientInput('to')).toBeHidden()
        await expectNoA11yViolations(page)
        await restored.close()
        await expect(restored.root).toBeHidden()

        // Back on the list, the email reloaded in its view
        await new EmailPage(page).back()
        const fresh = await mailbox.compose()
        await expect(fresh.recipientInput('to')).toBeFocused()
      }
    )
  })

  test('CMP-34 the draft saves itself after five minutes without a change; closing then asks nothing and offers to discard it', async ({
    page,
    user,
    jmap
  }) => {
    await page.clock.install()
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({
      to: [user.email],
      subject: 'Autosaved draft',
      body: 'Saved alone'
    })
    expect(await readMailbox(jmap, 'drafts')).toEqual([])

    await composer.idle()
    await expect(composer.saveStatus).toHaveText('Draft saved', {
      timeout: 10_000
    })
    expect(
      (await readMailbox(jmap, 'drafts')).map(draft => draft.subject)
    ).toEqual(['Autosaved draft'])

    await composer.close()
    await expect(page.getByTestId('confirm-dialog')).toBeHidden()
    await expect(mailbox.toast).toContainText('Draft saved')
    await page.getByTestId('composer-discard-draft-button').click()
    await expect.poll(async () => readMailbox(jmap, 'drafts')).toEqual([])
  })

  test('CMP-35 a file being uploaded is cancelled when removed; a file above the limit is refused', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // Slow uploads: the progress shows, the removal cancels
    await page.route('**/upload/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000))
      await route.continue().catch(() => undefined)
    })
    const chooser = page.waitForEvent('filechooser')
    await composer.attachFileButton.click()
    await (
      await chooser
    ).setFiles({
      name: 'slow.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('slow')
    })
    await expect(
      composer.root.getByRole('progressbar', { name: 'Uploading slow.txt' })
    ).toBeVisible()
    await expectNoA11yViolations(page)
    await composer.root.getByRole('button', { name: 'Remove slow.txt' }).click()
    await expect(composer.attachments).toHaveCount(0)
    await page.unroute('**/upload/**')

    // Above the total of tmail-backend (maxSizeAttachmentsPerEmail, 20 MB)
    const big = page.waitForEvent('filechooser')
    await composer.attachFileButton.click()
    await (
      await big
    ).setFiles({
      name: 'big.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(21_000_000)
    })
    const dialog = page.getByRole('dialog', { name: 'Maximum files size' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Got it' }).click()
    await expect(composer.attachments).toHaveCount(0)
  })

  test.describe('a draft never lost', () => {
    // Room for two small versions side by side, not for a big one
    test.use({ userQuota: { size: 8000 } })

    test('CMP-37 a draft save the quota refuses keeps the previous version; a version left by a lost destroy goes with the next save', async ({
      page,
      user,
      jmap
    }) => {
      await page.clock.install()
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.fill({
        to: [user.email],
        subject: 'Kept draft',
        body: 'Small'
      })
      await composer.idle()
      await expect(composer.saveStatus).toHaveText('Draft saved', {
        timeout: 10_000
      })
      const [kept] = await readMailbox(jmap, 'drafts')
      expect(kept?.subject).toBe('Kept draft')

      // Over the quota: refused, the saved version stays as it was
      await composer.editor.click()
      await page.keyboard.press('End')
      await page.keyboard.insertText('x'.repeat(6000))
      await composer.idle()
      await expect(composer.saveStatus).toHaveText('Draft not saved', {
        timeout: 10_000
      })
      const [stillThere, ...others] = await readMailbox(jmap, 'drafts')
      expect(others).toEqual([])
      expect(stillThere?.id).toBe(kept?.id)
      expect(stillThere && bodyOf(stillThere, stillThere.textBody)).toContain(
        'Small'
      )
      await expectNoA11yViolations(page)

      // Back under the quota: the new version replaces the kept one
      await page.keyboard.press('ControlOrMeta+z')
      await composer.subjectInput.fill('Kept draft, saved again')
      await composer.idle()
      await expect
        .poll(async () =>
          (await readMailbox(jmap, 'drafts')).map(draft => draft.subject)
        )
        .toEqual(['Kept draft, saved again'])

      // The request destroying the previous version is lost once
      let lost = 0
      await page.route('**/jmap', async route => {
        const body = route.request().postData() ?? ''
        if (
          lost === 0 &&
          body.includes('"destroy"') &&
          !body.includes('"create"')
        ) {
          lost += 1
          await route.abort()
          return
        }
        await route.continue()
      })
      await composer.subjectInput.fill('Third version')
      await composer.idle()
      await expect
        .poll(async () =>
          (await readMailbox(jmap, 'drafts')).map(draft => draft.subject).sort()
        )
        .toEqual(['Kept draft, saved again', 'Third version'])
      expect(lost).toBe(1)
      await page.unroute('**/jmap')
      const left = (await readMailbox(jmap, 'drafts')).map(draft => draft.id)

      // The next save destroys it with the version it replaces. Read
      // through Email/changes: once two emails are destroyed in one call,
      // the memory image drops the rest of the mailbox from Email/query
      const since = await emailState(jmap)
      await composer.subjectInput.fill('Fourth version')
      await composer.idle()
      await expect
        .poll(async () => (await emailChanges(jmap, since)).destroyed.sort())
        .toEqual([...left].sort())
      const { created } = await emailChanges(jmap, since)
      expect(await subjectsOf(jmap, created)).toEqual(['Fourth version'])
    })
  })

  test.describe('over quota', () => {
    test.use({ userQuota: { size: 4000 } })

    test('CMP-36 a message the quota refuses stays in the composer, the reason said', async ({
      page,
      user
    }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.fill({
        to: [user.email],
        subject: 'Too big for the quota'
      })
      await composer.editor.click()
      await page.keyboard.insertText('x'.repeat(6000))

      await composer.sendButton.click()

      await expect(composer.sendError).toContainText('over quota')
      await expect(composer.root).toBeVisible()
      await expectNoA11yViolations(page)
    })
  })

  test('CMP-46 the remote images of a reopened draft wait for "Show", and go with the message', async ({
    page,
    user,
    jmap
  }) => {
    const tracker = 'http://tracker.invalid/pixel.png'
    let loads = 0
    await page.route(tracker, async route => {
      loads += 1
      await route.fulfill({ body: PIXEL, contentType: 'image/png' })
    })
    const accountId = await jmap.accountId()
    const drafts = await jmap.findMailboxByRole('drafts')
    await jmap.request([
      [
        'Email/set',
        {
          accountId,
          create: {
            draft: {
              mailboxIds: { [drafts.id]: true },
              keywords: { $draft: true, $seen: true },
              from: [{ email: user.email }],
              to: [{ email: user.email }],
              subject: 'Tracked draft',
              bodyValues: {
                html: {
                  value: `<div>Hello <img src="${tracker}" alt="pixel"></div>`
                }
              },
              htmlBody: [{ partId: 'html', type: 'text/html' }]
            }
          }
        },
        'c'
      ]
    ])
    const mailbox = await new LoginPage(page).loginAs(user)

    const composer = await openDraft(mailbox, 'Tracked draft')

    const banner = composer.root.getByTestId('remote-content-banner')
    await expect(banner).toBeVisible()
    await expect(composer.editor.locator('img[alt="pixel"]')).toHaveAttribute(
      'data-blocked-src',
      tracker
    )
    expect(loads).toBe(0)
    await expectNoA11yViolations(page)

    await banner.getByTestId('remote-content-show-button').click()
    await expect(composer.editor.locator('img[alt="pixel"]')).toHaveAttribute(
      'src',
      tracker
    )
    await expect.poll(() => loads).toBeGreaterThan(0)
    await composer.send()
    const sent = await jmap.waitForEmail({
      subject: 'Tracked draft',
      mailboxRole: 'sent'
    })
    const [read] = (await readMailbox(jmap, 'sent')).filter(
      email => email.id === sent.id
    )
    expect(read && bodyOf(read, read.htmlBody)).toContain(`src="${tracker}"`)
  })

  test('CMP-47 a version created by a save whose answer was lost goes with the next save', async ({
    page,
    user,
    jmap
  }) => {
    await page.clock.install()
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // The first save reaches the server, its answer never comes back
    let lost = 0
    await page.route('**/jmap', async route => {
      const body = route.request().postData() ?? ''
      if (lost === 0 && body.includes('"create"')) {
        lost += 1
        await route.fetch()
        await route.abort()
        return
      }
      await route.continue()
    })
    await composer.fill({
      to: [user.email],
      subject: 'Lost answer',
      body: 'First'
    })
    await composer.idle()
    await expect(composer.saveStatus).toHaveText('Draft not saved', {
      timeout: 10_000
    })
    expect(lost).toBe(1)
    await expect
      .poll(async () =>
        (await readMailbox(jmap, 'drafts')).map(draft => draft.subject)
      )
      .toEqual(['Lost answer'])
    const [stray] = await readMailbox(jmap, 'drafts')

    await composer.subjectInput.fill('Lost answer, saved again')
    await composer.idle()

    await expect
      .poll(async () =>
        (await readMailbox(jmap, 'drafts')).map(draft => draft.subject)
      )
      .toEqual(['Lost answer, saved again'])
    const [kept] = await readMailbox(jmap, 'drafts')
    expect(kept?.id).not.toBe(stray?.id)
    await page.unroute('**/jmap')
  })
})
