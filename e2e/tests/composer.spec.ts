import { readFileSync } from 'node:fs'
import path from 'node:path'

import { ComposerPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { copyHtml, makePng } from '../support/clipboard'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

const CLIPBOARD = path.resolve(__dirname, '../fixtures/clipboard')

/** Sets the HTML signature of the default identity */
async function setSignature(jmap: JmapClient, html: string): Promise<void> {
  const accountId = await jmap.accountId()
  const [identities] = await jmap.request([
    ['Identity/get', { accountId, ids: null }, 'i']
  ])
  const identityId = (identities?.[1].list as { id: string }[])[0]?.id ?? ''
  await jmap.request([
    [
      'Identity/set',
      { accountId, update: { [identityId]: { htmlSignature: html } } },
      's'
    ]
  ])
}

/** The drafts of the account, with their HTML body */
async function readDrafts(jmap: JmapClient): Promise<
  {
    id: string
    subject: string
    to: { email: string }[]
    replyTo: unknown
    html: string
  }[]
> {
  const accountId = await jmap.accountId()
  const drafts = await jmap.findMailboxByRole('drafts')
  const [, got] = await jmap.request([
    ['Email/query', { accountId, filter: { inMailbox: drafts.id } }, 'q'],
    [
      'Email/get',
      {
        accountId,
        '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
        // A body property before the others (tmail-backend#2686)
        properties: ['htmlBody', 'bodyValues', 'subject', 'to', 'replyTo'],
        fetchHTMLBodyValues: true
      },
      'g'
    ]
  ])
  const list = (got?.[1].list ?? []) as {
    id: string
    subject: string
    to: { email: string }[]
    replyTo: unknown
    bodyValues: Record<string, { value: string }>
  }[]
  return list.map(email => ({
    id: email.id,
    subject: email.subject,
    to: email.to,
    replyTo: email.replyTo,
    html: Object.values(email.bodyValues)[0]?.value ?? ''
  }))
}

test.describe('CMP composer', () => {
  test(
    'CMP-05 the recipient fields fold into a summary once the focus moves on, and unfold',
    {
      tag: '@mobile'
    },
    async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await expect(composer.recipientInput('to')).toBeFocused()

      await composer.showField('cc')
      await expect(composer.recipientInput('cc')).toBeFocused()
      await composer.showField('bcc')
      await composer.showField('reply-to')
      for (const field of ['to', 'cc', 'bcc', 'reply-to'] as const) {
        await expect(composer.recipientInput(field)).toBeVisible()
      }
      await composer.addRecipient('cc', 'carol@example.com')
      await expectNoA11yViolations(page)

      await composer.subjectInput.click()
      await expect(composer.recipientsSummary).toBeVisible()
      await expect(composer.recipientsSummary).toContainText(
        'carol@example.com'
      )
      for (const field of ['to', 'cc', 'bcc', 'reply-to'] as const) {
        await expect(composer.recipientInput(field)).toBeHidden()
      }

      await composer.recipientsSummary.click()
      await expect(composer.recipientInput('to')).toBeFocused()
      for (const field of ['to', 'cc', 'bcc', 'reply-to'] as const) {
        await expect(composer.recipientInput(field)).toBeVisible()
      }
      await expect(
        composer.recipients('cc').filter({ hasText: 'carol@example.com' })
      ).toBeVisible()
    }
  )

  test('CMP-06 Ctrl+K opens the link dialog of the app; bold, lists and colour format the body', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // As tmail-flutter the formatting toolbar opens with "Aa"
    await composer.showFormattingToolbar()
    await composer.editor.click()
    await page.keyboard.type('Hello ')
    const bold = composer.toolbarButton('Bold')
    await expect(bold).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.press('Control+B')
    await expect(bold).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.type('world')
    await page.keyboard.press('Control+B')
    await page.keyboard.press('Enter')
    await composer.chooseFromMenu('Lists and indentation', 'Bulleted list')
    await page.keyboard.type('first')
    await page.keyboard.press('Enter')
    await page.keyboard.type('second')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await composer.toolbarButton('Text Color').click()
    await page.getByRole('radio', { name: 'Red', exact: true }).click()
    await page.keyboard.type('red text ')
    await composer.toolbarButton('Text Color').click()
    await page.getByRole('button', { name: 'Reset to default' }).click()

    await page.keyboard.press('Control+K')
    const dialog = page.getByRole('dialog', { name: 'Insert link' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('link-dialog-url-input')).toBeFocused()
    await dialog.getByTestId('link-dialog-text-input').fill('Twake')
    await dialog.getByTestId('link-dialog-url-input').fill('https://twake.app')
    await expectNoA11yViolations(page)
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(composer.editor).toBeFocused()

    const html = await composer.editorHtml()
    expect(html).toContain('<strong>world</strong>')
    expect(html).toContain(
      '<ul><li><p>first</p></li><li><p>second</p></li></ul>'
    )
    expect(html).toContain(
      '<span style="color: rgb(255, 77, 77);">red text </span>'
    )
    expect(html).toMatch(/<a [^>]*href="https:\/\/twake.app"[^>]*>Twake<\/a>/)
  })

  test('CMP-27 composer windows minimize, go full screen and stay open side by side', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const first = await mailbox.compose()
    await first.fill({ to: ['first@example.com'], subject: 'First message' })
    await first.expectMode('normal')
    await expectNoA11yViolations(page)

    // Escape minimizes a docked window; its title bar gives it back
    await first.subjectInput.focus()
    await page.keyboard.press('Escape')
    await first.expectMode('minimized')
    const restore = first.root.getByRole('button', {
      name: 'Show: First message'
    })
    await expect(restore).toBeFocused()
    await page.keyboard.press('Enter')
    await first.expectMode('normal')
    await expect(first.subjectInput).toBeFocused()

    // A second one opens next to it; the first keeps what was typed
    await mailbox.composeButton.click()
    const second = new ComposerPage(page)
    await expect(page.getByTestId('composer')).toHaveCount(2)
    await expect(second.recipientInput('to')).toBeFocused()
    await second.subjectInput.fill('Second message')
    await expect(
      page.getByRole('dialog', { name: 'Second message' })
    ).toBeVisible()
    await expect(
      page.getByRole('dialog', { name: 'First message' })
    ).toBeVisible()

    // Full screen: modal; Escape there closes, asking first
    await second.fullscreenButton.click()
    await second.expectMode('fullscreen')
    await expect(second.root).toHaveAttribute('aria-modal', 'true')
    // The page behind takes no click
    await mailbox.composeButton.click({ force: true })
    await expect(page.getByTestId('composer')).toHaveCount(2)
    await expectNoA11yViolations(page)
    // A change not saved yet (the draft waits five minutes of inactivity): closing asks
    await second.subjectInput.press('End')
    await page.keyboard.type('!')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('confirm-dialog')).toBeVisible()
    await page.getByTestId('confirm-dialog-alternative-button').click()
    await expect(page.getByTestId('composer')).toHaveCount(1)
    await expect(
      page.getByRole('dialog', { name: 'First message' })
    ).toBeVisible()
  })

  test('CMP-49 composers the screen has no room for stay reachable from a menu', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    for (const subject of ['First', 'Second', 'Third']) {
      const composer = await mailbox.compose()
      await composer.subjectInput.fill(subject)
      await expect(page.getByRole('dialog', { name: subject })).toBeVisible()
    }

    // A phone: the newest fills the screen, the others are in the menu of its top bar
    await page.setViewportSize({ width: 390, height: 800 })
    await expect(page.getByRole('dialog', { name: 'Third' })).toHaveAttribute(
      'aria-modal',
      'true'
    )
    await expect(
      page
        .getByRole('dialog', { name: 'Third' })
        .getByTestId('composer-send-button')
    ).toBeVisible()
    await expect(mailbox.composerOverflowButton).toHaveText('+2 messages')
    await expect(mailbox.composerOverflowButton).toHaveAttribute(
      'aria-haspopup',
      'menu'
    )
    await mailbox.composerOverflowButton.click()
    await expect(mailbox.composerOverflowMenu.getByRole('menuitem')).toHaveText(
      ['Second', 'First']
    )
    await expectNoA11yViolations(page)
    await page.keyboard.press('Escape')
    await expect(mailbox.composerOverflowButton).toBeFocused()
    const first = await mailbox.showComposerFromOverflow('First')
    await expect(first.root).toHaveAttribute('aria-modal', 'true')
    await expect(page.getByRole('dialog', { name: 'Third' })).toBeHidden()

    // A narrow desktop: two shared windows (600 px) in the dock, no room
    // left for a minimized one (400 px), the oldest in the menu at its start
    await page.setViewportSize({ width: 1420, height: 800 })
    await expect(page.getByRole('dialog', { name: 'First' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Third' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Second' })).toBeHidden()
    await expect(mailbox.composerOverflowButton).toHaveText('+1 message')
    const second = await mailbox.showComposerFromOverflow('Second')
    await expect(second.subjectInput).toHaveValue('Second')
    await expectNoA11yViolations(page)
  })

  test('CMP-28 recipients: a pasted list, an invalid address, chips edited and removed with the keyboard, contacts suggested', async ({
    page,
    user,
    webadmin
  }) => {
    const contact = `zelda-${Date.now()}@example.com`
    await webadmin.createDomainContact('example.com', {
      emailAddress: contact,
      firstname: 'Zelda',
      surname: 'Contact'
    })
    try {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      const to = composer.recipientInput('to')

      await copyHtml(
        page,
        'alice@example.com',
        'alice@example.com, Bob <bob@example.com>; wrong'
      )
      await to.focus()
      await page.keyboard.press('Control+V')
      await expect(composer.recipients('to')).toHaveText([
        'alice@example.com',
        'Bob',
        'wrong'
      ])
      await expect(composer.recipients('to').last()).toHaveAccessibleName(
        'wrong, invalid address'
      )

      // Backspace reaches the last chip, Delete removes it, F2 edits one
      await page.keyboard.press('Backspace')
      await expect(composer.recipients('to').last()).toBeFocused()
      await page.keyboard.press('Delete')
      await expect(composer.recipients('to')).toHaveText([
        'alice@example.com',
        'Bob'
      ])
      // Without a chip after it, the input has the focus again
      await expect(to).toBeFocused()
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
      await expect(composer.recipients('to').first()).toBeFocused()
      await page.keyboard.press('F2')
      await expect(to).toBeFocused()
      await expect(to).toHaveValue('alice@example.com')
      await page.keyboard.press('Enter')
      await expect(composer.recipients('to')).toHaveText([
        'Bob',
        'alice@example.com'
      ])

      // Contacts of the domain are suggested
      await page.keyboard.type('Zel')
      const suggestion = composer.root.getByRole('option', {
        name: /Zelda Contact/
      })
      await expect(suggestion).toBeVisible()
      await expectNoA11yViolations(page)
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await expect(composer.recipients('to')).toHaveText([
        'Bob',
        'alice@example.com',
        'Zelda Contact'
      ])
      await expect(composer.recipients('to').last()).toHaveAttribute(
        'title',
        `Zelda Contact <${contact}>`
      )
    } finally {
      await webadmin.deleteDomainContact('example.com', contact)
    }
  })

  test('CMP-29 the formatting toolbar is one tab stop and the editor no keyboard trap', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // As tmail-flutter the formatting toolbar opens with "Aa"
    await composer.showFormattingToolbar()
    await expect(composer.editor).toHaveAttribute('aria-multiline', 'true')

    // Subject -> editor -> toolbar (under the text); as tmail-flutter, no undo
    // nor redo button (Ctrl+Z, Ctrl+Y)
    await expect(composer.toolbarButton('Undo')).toHaveCount(0)
    await composer.subjectInput.focus()
    await page.keyboard.press('Tab')
    await expect(composer.editor).toBeFocused()
    await page.keyboard.press('Tab')
    const first = composer.toolbar.getByRole('button').first()
    await expect(first).toBeFocused()
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight')
    await expect(composer.toolbarButton('Bold')).toBeFocused()
    await page.keyboard.press('End')
    await expect(composer.toolbarButton('Clear formatting')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(first).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(composer.editor).toBeFocused()

    // Alt+F10 goes to the toolbar (on the last used button), Escape comes back
    await page.keyboard.type('text')
    await page.keyboard.press('Alt+F10')
    await expect(first).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Escape')
    await expect(composer.editor).toBeFocused()
    await composer.expectMode('normal')

    // In a list, Tab indents; at the first item it cannot, so it leaves
    await page.keyboard.press('Enter')
    await composer.chooseFromMenu('Lists and indentation', 'Bulleted list')
    await page.keyboard.type('item')
    await page.keyboard.press('Tab')
    await expect(composer.editor).not.toBeFocused()
    await composer.editor.getByText('item').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('nested')
    await page.keyboard.press('Tab')
    await expect(composer.editor).toBeFocused()
    expect(await composer.editorHtml()).toContain(
      '<ul><li><p>nested</p></li></ul>'
    )
    await page.keyboard.press('Alt+F10')
    await page.keyboard.press('Shift+Tab')
    await expect(composer.editor).toBeFocused()

    // Tooltips carry the same text as the aria-label
    await composer.toolbarButton('Italic').hover()
    await expect(page.getByRole('tooltip', { name: 'Italic' })).toBeVisible()
  })

  test('CMP-30 an inline image is resized and removed with the keyboard', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.subjectInput.fill('Resized image')
    const png = await makePng(page, 800, 400, 'RESIZE')
    await composer.editor.click()
    await page.keyboard.type('Before ')
    const chooser = page.waitForEvent('filechooser')
    await composer.insertImageButton.click()
    await (
      await chooser
    ).setFiles({ name: 'resize.png', mimeType: 'image/png', buffer: png })
    const image = composer.editor.locator('img[data-reference]')
    await expect(image).toHaveCount(1, { timeout: 20_000 })
    await expect
      .poll(() =>
        image.evaluate(element => (element as HTMLImageElement).naturalWidth)
      )
      .toBe(800)

    // The caret is after the image: ArrowLeft selects it, Enter opens its toolbar
    await page.keyboard.press('ArrowLeft')
    const toolbar = composer.root.getByRole('toolbar', {
      name: 'Image options'
    })
    await expect(toolbar).toBeVisible()
    await expect(
      composer.root.getByRole('status').filter({ hasText: 'Width 800 px' })
    ).toBeVisible()
    await page.keyboard.press('Enter')
    const quarter = toolbar.getByRole('button', { name: '25%' })
    await expect(quarter).toBeFocused()
    await expectNoA11yViolations(page)

    await page.keyboard.press('Enter')
    await expect(quarter).toHaveAttribute('aria-pressed', 'true')
    await expect(
      composer.root.getByRole('status').filter({ hasText: 'Width 200 px, 25%' })
    ).toBeVisible()
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowLeft')
    await expect(toolbar.getByRole('button', { name: 'Larger' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      composer.root.getByRole('status').filter({ hasText: 'Width 280 px, 35%' })
    ).toBeVisible()
    await expect(image).toHaveCSS('width', '280px')

    // The saved draft keeps the size
    await composer.runMoreAction('save-draft')
    await expect(mailbox.toast).toContainText('Draft saved')
    await expect
      .poll(async () => (await readDrafts(jmap))[0]?.html ?? '')
      .toMatch(
        /<img[^>]*src="cid:[^"]+"[^>]*width="280"|<img[^>]*width="280"[^>]*src="cid:/
      )

    // A click selects it too; Escape goes back to the text, the image still selected
    await image.click()
    await expect(toolbar).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(toolbar.getByRole('button', { name: 'Larger' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(composer.editor).toBeFocused()
    await composer.expectMode('normal')
    await page.keyboard.press('Enter')
    await page.keyboard.press('End')
    await expect(
      page.getByTestId('rich-text-image-remove-button')
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(image).toHaveCount(0)
    await expect(toolbar).toBeHidden()
  })

  test('CMP-31 a click under a list ending the text gives a line above the signature', async ({
    page,
    user,
    jmap
  }) => {
    await setSignature(jmap, '<p>SIGNATURE_MARKER</p>')
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // As tmail-flutter the formatting toolbar opens with "Aa"
    await composer.showFormattingToolbar()
    await expect(composer.editor).toContainText('SIGNATURE_MARKER')
    await composer.editor.click({ position: { x: 20, y: 10 } })
    await composer.chooseFromMenu('Lists and indentation', 'Bulleted list')
    await page.keyboard.type('item')
    expect(await composer.editorHtml()).toMatch(/<\/ul><div[^>]*node-htmlBlock/)

    await composer.editor.getByText('SIGNATURE_MARKER').click()
    await page.keyboard.type('after the list')
    expect(await composer.editorHtml()).toMatch(
      /<\/ul><p>after the list<\/p><div[^>]*node-htmlBlock/
    )
  })

  test.describe('CMP-32 pasting into the body keeps clean HTML', () => {
    const NOISE = [
      /mso-/i,
      /class="Mso/,
      /o:p/,
      /font-family/,
      /font-size/,
      /line-height/,
      /Liberation/,
      /rgb\(0, 0, 0\)/,
      /#000000/,
      /rgb\(33, 37, 41\)/
    ]
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
          /<th[^>]*><p>Col A<\/p><\/th>/,
          /<a [^>]*href="https:\/\/example.org\/doc"[^>]*>un lien<\/a>/,
          'Attention : alerte'
        ]
      }
    ]

    for (const { name, expected } of CASES) {
      test(`CMP-32 from ${name}`, async ({ page, user }) => {
        const mailbox = await new LoginPage(page).loginAs(user)
        const composer = await mailbox.compose()
        await composer.editor.click()
        await copyHtml(
          page,
          readFileSync(path.join(CLIPBOARD, `${name}.html`), 'utf8'),
          readFileSync(path.join(CLIPBOARD, `${name}.txt`), 'utf8')
        )
        await page.keyboard.press('Control+V')
        await expect
          .poll(() => composer.editorHtml())
          .not.toMatch(/^<p><br[^>]*><\/p>$/)
        const result = await composer.editorHtml()
        for (const fragment of expected) {
          if (typeof fragment === 'string') expect(result).toContain(fragment)
          else expect(result).toMatch(fragment)
        }
        for (const noise of NOISE) expect(result).not.toMatch(noise)
      })
    }

    test('CMP-32 as plain text with Ctrl+Shift+V', async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.editor.click()
      await copyHtml(
        page,
        readFileSync(path.join(CLIPBOARD, 'word.html'), 'utf8'),
        readFileSync(path.join(CLIPBOARD, 'word.txt'), 'utf8')
      )
      await page.keyboard.press('Control+Shift+V')
      await expect.poll(() => composer.editorHtml()).toContain('Premier point')
      const result = await composer.editorHtml()
      expect(result).not.toContain('<strong>')
      expect(result).not.toContain('<ul>')
      expect(result).toContain('<p>Compte rendu de réunion</p>')
    })
  })

  test('CMP-33 c opens the composer from the keyboard, and closing it gives the focus back', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Focus anchor',
      text: 'hello'
    })
    await jmap.waitForEmail({ subject: 'Focus anchor' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRowLink('Focus anchor')
    await row.focus()

    await page.keyboard.press('c')
    const composer = new ComposerPage(page)
    await expect(composer.root).toBeVisible()
    await expect(composer.recipientInput('to')).toBeFocused()
    // Shortcuts are off in the composer: `c` types
    await page.keyboard.type('c')
    await expect(composer.recipientInput('to')).toHaveValue('c')
    await page.keyboard.press('Backspace')

    await composer.close()
    await expect(composer.root).toBeHidden()
    await expect(row).toBeFocused()
  })

  test('CMP-61 the From line opens from its button on the To line', async ({
    page,
    user,
    jmap
  }) => {
    const accountId = await jmap.accountId()
    await jmap.request([
      [
        'Identity/set',
        {
          accountId,
          create: {
            first: { name: 'Identity 1', email: user.email, sortOrder: 0 },
            second: { name: 'Identity 2', email: user.email, sortOrder: 1 }
          }
        },
        's'
      ]
    ])
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await expect(composer.identitySelect).toBeHidden()
    await composer.root.getByTestId('composer-show-from-button').click()
    await expect(composer.identitySelect).toContainText('Identity 1')
    await expect(
      composer.root.getByTestId('composer-show-from-button')
    ).toHaveCount(0)
    await composer.chooseIdentity('Identity 2')
    await expectNoA11yViolations(page)
  })

  test('CMP-62 Cc and Bcc open as lines of the To template and go away, emptied, with their close button', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.addRecipient('to', 'bob@example.com')
    await composer.showField('cc')
    await composer.showField('bcc')
    await composer.addRecipient('cc', 'carol@example.com')
    const to = await composer.root
      .getByTestId('composer-to-field')
      .boundingBox()
    const bcc = await composer.root
      .getByTestId('composer-bcc-field')
      .boundingBox()
    expect(bcc?.width).toBe(to?.width)
    // The 48 px lines of tmail-flutter's composer
    expect(bcc?.height).toBe(48)
    await expectNoA11yViolations(page)

    await composer.root.getByTestId('composer-hide-cc-button').click()
    await expect(composer.recipientInput('cc')).toBeHidden()
    await expect(composer.recipientInput('to')).toBeFocused()
    await composer.showField('cc')
    await expect(composer.recipients('cc')).toHaveCount(0)
  })

  test('CMP-63 the formatting toolbar sits under the text, its footer button shows it or not, and the link button opens the dialog', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // As tmail-flutter: hidden until "Aa" shows it
    await expect(composer.toolbar).toBeHidden()
    await expect(composer.formattingButton).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await composer.formattingButton.click()
    await expect(composer.toolbar).toBeVisible()
    await expect(composer.formattingButton).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const editor = await composer.editor.boundingBox()
    const toolbar = await composer.toolbar.boundingBox()
    expect(toolbar?.y).toBeGreaterThan(editor?.y ?? Infinity)

    await composer.formattingButton.click()
    await expect(composer.toolbar).toBeHidden()
    await composer.formattingButton.click()
    await expect(composer.toolbar).toBeVisible()

    await composer.root.getByTestId('rich-text-link-button').click()
    await expect(
      page.getByRole('dialog', { name: 'Insert link' })
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('CMP-64 the expanded composer is centred over the dimmed page, as tmail-flutter', async ({
    page,
    user
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop geometry')
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fullscreenButton.click()
    await composer.expectMode('fullscreen')
    const box = await composer.root.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(viewport).not.toBeNull()
    const width = viewport?.width ?? 0
    const height = viewport?.height ?? 0
    // 85 % of the width, 90 % of the height, in the middle
    expect(Math.abs((box?.width ?? 0) - width * 0.85)).toBeLessThan(2)
    expect(Math.abs((box?.height ?? 0) - height * 0.9)).toBeLessThan(2)
    expect(
      Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2)
    ).toBeLessThan(2)
    expect(
      Math.abs((box?.y ?? 0) + (box?.height ?? 0) / 2 - height / 2)
    ).toBeLessThan(2)
    await composer.fullscreenButton.click()
    await composer.expectMode('normal')
  })
})
