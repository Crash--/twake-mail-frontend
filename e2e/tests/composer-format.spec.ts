import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

interface ReadEmail {
  htmlBody: { partId: string }[]
  bodyValues: Record<string, { value: string }>
}

/** The HTML body of the first email of the inbox */
async function inboxHtml(jmap: JmapClient): Promise<string> {
  const accountId = await jmap.accountId()
  const inbox = await jmap.findMailboxByRole('inbox')
  const [, got] = await jmap.request([
    ['Email/query', { accountId, filter: { inMailbox: inbox.id } }, 'q'],
    [
      'Email/get',
      {
        accountId,
        '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
        properties: ['htmlBody', 'bodyValues'],
        bodyProperties: ['partId', 'type'],
        fetchHTMLBodyValues: true
      },
      'g'
    ]
  ])
  const email = ((got?.[1].list ?? []) as ReadEmail[])[0]
  if (!email) return ''
  return email.htmlBody
    .map(part => email.bodyValues[part.partId]?.value ?? '')
    .join('')
}

test.describe('CMP composer: formatting toolbar and emoji', () => {
  test('CMP-80 the toolbar menus work with the keyboard and keep their state', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // As tmail-flutter the formatting toolbar opens with "Aa"
    await composer.showFormattingToolbar()
    await composer.editor.click()
    await page.keyboard.type('Title')

    await page.keyboard.press('Alt+F10')
    const style = composer.toolbarButton('Text style Normal')
    await expect(style).toBeFocused()
    await expect(style).toHaveAttribute('aria-haspopup', 'menu')
    await expect(style).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('Enter')
    // An open menu hides the page behind it: the button is found by its id
    const styleById = composer.root.getByTestId('rich-text-text-style-button')
    await expect(styleById).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('menu')).toBeVisible()
    await expectNoA11yViolations(page)
    // tmail-flutter's order: Normal, Quote, Code, Header 1…
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(composer.editor.locator('h1')).toHaveText('Title')
    await expect(composer.toolbarButton('Text style Header 1')).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    // Escape closes a menu without applying anything
    await composer.toolbarButton('Text style Header 1').click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(composer.editor.locator('h1')).toHaveText('Title')

    // The colour popover: a labelled dialog, a radio group, Escape closes
    await composer.toolbarButton('Text Color').click()
    const dialog = page.getByRole('dialog', { name: 'Text Color' })
    await expect(dialog).toBeVisible()
    await expectNoA11yViolations(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expectNoA11yViolations(page)
  })

  test('CMP-81 each control formats the text and the recipient receives it as written', async ({
    page,
    user,
    users,
    jmapFor
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // As tmail-flutter the formatting toolbar opens with "Aa"
    await composer.showFormattingToolbar()
    await composer.fill({ to: [bob.email], subject: 'Formatting' })
    await composer.editor.click()
    await page.keyboard.type('Styled words')
    await page.keyboard.press('Control+A')

    await composer.chooseFromMenu('Text style Normal', 'Header 2')
    await composer.chooseFromMenu('Text Size 14', '24')
    await composer.chooseFromMenu('Font Sans Serif', 'Times New Roman')
    await composer.toolbarButton('Text Color').click()
    await page.getByRole('radio', { name: 'Red', exact: true }).click()
    await composer.toolbarButton('Highlight color').click()
    await page.getByRole('radio', { name: 'Yellow', exact: true }).click()
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough']) {
      await composer.toolbarButton(name).click()
      await expect(composer.toolbarButton(name)).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    }
    await composer.chooseFromMenu('Paragraph', 'Align center')
    await composer.chooseFromMenu('Lists and indentation', 'Increase indent')

    // The buttons say what the selection has
    await expect(composer.toolbarButton('Text style Header 2')).toBeVisible()
    await expect(composer.toolbarButton('Text Size 24')).toBeVisible()
    await expect(composer.toolbarButton('Font Times New Roman')).toBeVisible()
    await expectNoA11yViolations(page)

    await composer.send()
    const html = await inboxHtml(jmapFor(bob))
    expect(html).toContain('<h2')
    expect(html).toContain('text-align: center')
    expect(html).toContain('margin-left: 24px')
    expect(html).toMatch(/font-family: ?(&quot;|")?Times New Roman/)
    expect(html).toContain('font-size: 24px')
    expect(html).toMatch(/color: (#ff4d4d|rgb\(255, 77, 77\))/)
    expect(html).toMatch(/background-color: (#ffd600|rgb\(255, 214, 0\))/)
    for (const tag of ['strong', 'em', 'u', 's']) {
      expect(html).toContain(`<${tag}>`)
    }
  })

  test('CMP-82 the emoji picker inserts at the caret and gives the focus back to the text', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.editor.click()
    await page.keyboard.type('Hi ')

    const button = composer.root.getByTestId('composer-emoji-button')
    await button.click()
    const picker = page.getByRole('dialog', { name: 'Emoji' })
    await expect(picker).toBeVisible()
    await expect(
      picker.getByRole('searchbox', { name: 'Search emoji' })
    ).toBeFocused()
    await expect(picker.getByRole('heading', { name: 'Recent' })).toBeVisible()
    await expectNoA11yViolations(page)

    await page.keyboard.type('grinning')
    await picker.getByRole('button', { name: 'grinning face' }).first().click()
    await expect(picker).toBeHidden()
    await expect(composer.editor).toBeFocused()
    await expect(composer.editor).toContainText('Hi 😀')

    // Escape closes it, as a click outside, and the text has the focus again
    await button.click()
    await expect(picker).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    await expect(composer.editor).toBeFocused()
    await button.click()
    await composer.subjectInput.click({ force: true })
    await expect(picker).toBeHidden()
  })

  test(
    'CMP-83 on a phone the footer stays on one line, without emoji button, and the toolbar scrolls',
    { tag: '@mobile' },
    async ({ page, user }) => {
      test.skip(
        (page.viewportSize()?.width ?? 0) >= 600,
        'The top bar of the phones'
      )
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()

      await expect(
        composer.root.getByTestId('composer-emoji-button')
      ).toHaveCount(0)
      const boxes = await Promise.all(
        [
          composer.formattingButton,
          composer.attachFileButton,
          composer.moreButton,
          composer.sendButton
        ].map(locator => locator.boundingBox())
      )
      const centres = boxes.map(
        box => (box?.y ?? -100) + (box?.height ?? 0) / 2
      )
      expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(4)
      await expect(composer.sendButton).toHaveAccessibleName('Send')

      // One line, scrolling sideways; the last button is reachable
      await composer.showFormattingToolbar()
      const toolbarBox = await composer.toolbar.boundingBox()
      expect(toolbarBox?.height).toBeLessThan(70)
      const last = composer.toolbarButton('Lists and indentation')
      await last.scrollIntoViewIfNeeded()
      await expect(last).toBeInViewport()
      await last.click()
      await page.keyboard.press('Escape')
      await expectNoA11yViolations(page)
    }
  )
})
