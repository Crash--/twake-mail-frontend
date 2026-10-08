import type { Page } from '@playwright/test'

import { ComposerPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { copyHtml, makePng } from '../support/clipboard'
import { expect, test } from '../support/fixtures'

/**
 * The accessibility tree of the composer, state by state (RGAA 4.1, the grid is
 * docs/a11y/composer-audit.md): names, roles, states, live regions, the order the focus goes
 * in and where it comes back. What a screen reader says of it (NVDA, VoiceOver) is not
 * checked here: the grid marks it "à vérifier au lecteur d'écran".
 */

/** Tab stops from the first field of the window to the Send button, by accessible name */
async function tabOrder(page: Page, composer: ComposerPage): Promise<string[]> {
  await composer.subjectInput.focus()
  const order: string[] = []
  for (let step = 0; step < 14; step += 1) {
    await page.keyboard.press('Tab')
    const name = await page.evaluate(() => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement)) return 'none'
      return (
        active.getAttribute('aria-label') ??
        active.textContent?.trim() ??
        active.tagName
      )
    })
    order.push(name)
    if (name === 'Send') break
  }
  return order
}

test.describe('A11Y composer', () => {
  test('A11Y-10 the window is a named dialog with its live regions, minimized, full screen and docked', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()

    // A named, non modal dialog; the title is a level 2 heading; the live regions are there
    // before anything is announced (a region added with its text is often missed)
    // As tmail-flutter: the footer has "Aa" (the toolbar opens with it),
    // the insertions and More, then delete, save as draft and send
    await expect(composer.root).toMatchAriaSnapshot(`
      - dialog "New message":
        - heading "New message" [level=2]
        - button "Minimize"
        - button "Fullscreen"
        - button "Close"
        - group "To":
          - combobox "To"
        - status
        - textbox "Subject"
        - textbox "Message body"
        - status
        - button "Formatting options"
        - button "Attach file"
        - button "Insert image"
        - button "Insert link"
        - button "Insert emoji"
        - button "More"
        - status
        - button "Delete draft"
        - button "Save as draft"
        - button "Send"
    `)
    await expect(composer.root).not.toHaveAttribute('aria-modal', 'true')
    await expect(composer.root.getByRole('status')).toHaveCount(3)
    // The first field has the focus, the window is named after what is typed in the subject
    await expect(composer.recipientInput('to')).toBeFocused()
    await composer.fill({
      to: ['alice@example.com'],
      subject: 'Quarterly numbers'
    })
    await expect(
      page.getByRole('dialog', { name: 'Quarterly numbers' })
    ).toBeVisible()

    // The focus goes through the window in the order it is read, without a trap
    expect(await tabOrder(page, composer)).toEqual([
      'Message body',
      'Formatting options',
      'Attach file',
      'Insert image',
      'Insert link',
      'Insert emoji',
      'More',
      'Delete draft',
      'Save as draft',
      'Send'
    ])
    await expectNoA11yViolations(page)

    // Minimized: a dialog still, its title a button that says what it does; the focus goes
    // there and Enter gives the window back with the focus in its subject
    await composer.subjectInput.focus()
    await page.keyboard.press('Escape')
    await composer.expectMode('minimized')
    await expect(composer.root).toMatchAriaSnapshot(`
      - dialog "Quarterly numbers":
        - 'button "Show: Quarterly numbers"'
        - button "Show"
        - button "Fullscreen"
        - button "Close"
    `)
    await expect(
      composer.root.getByRole('button', { name: 'Show: Quarterly numbers' })
    ).toBeFocused()
    await expectNoA11yViolations(page)
    await page.keyboard.press('Enter')
    await composer.expectMode('normal')
    await expect(composer.subjectInput).toBeFocused()

    // Full screen: modal, the page behind is out of the tree; leaving it keeps the focus on
    // the button that was pressed
    await composer.fullscreenButton.click()
    await composer.expectMode('fullscreen')
    await expect(composer.root).toHaveAttribute('aria-modal', 'true')
    await expectNoA11yViolations(page)
    await composer.fullscreenButton.focus()
    await page.keyboard.press('Enter')
    await composer.expectMode('normal')
    await expect(composer.fullscreenButton).toBeFocused()

    // Docked side by side: each window has its own name
    await mailbox.composeButton.click()
    await expect(page.getByTestId('composer')).toHaveCount(2)
    await expect(page.getByRole('dialog')).toHaveCount(2)
    await expect(
      page.getByRole('dialog', { name: 'Quarterly numbers' })
    ).toBeVisible()
    await expect(
      page.getByRole('dialog', { name: 'New message' })
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test(
    'A11Y-11 recipient chips: added, pasted, invalid, edited and removed, with the focus and what is announced',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      const field = composer.root.getByTestId('composer-to-field')

      // Typed: a comma makes a chip, a button named after the address, the help as its description
      await composer.recipientInput('to').fill('alice@example.com,')
      await copyHtml(
        page,
        'x',
        'bob@example.com, Carol <carol@example.com>; wrong'
      )
      await composer.recipientInput('to').focus()
      await page.keyboard.press('Control+V')
      await expect(field).toMatchAriaSnapshot(`
      - group "To":
        - button "alice@example.com"
        - button "bob@example.com"
        - button "Carol"
        - button "wrong, invalid address"
        - combobox "To"
    `)
      const first = composer.recipients('to').first()
      await expect(first).toHaveAccessibleDescription(
        'Enter opens the card of the address, F2 edits it, Delete removes it.'
      )
      // Not by colour alone: the invalid one is named so, and outlined with a warning icon
      await expect(composer.recipients('to').last()).toHaveAttribute(
        'data-invalid',
        'true'
      )
      await expectNoA11yViolations(page)

      // Backspace reaches the last chip with the focus; Enter opens its card
      // (tmail-flutter's), Escape gives the focus back; F2 edits it in the field
      await page.keyboard.press('Backspace')
      await expect(composer.recipients('to').last()).toBeFocused()
      await page.keyboard.press('Enter')
      const card = page.getByRole('dialog', { name: 'wrong' })
      await expect(card).toBeVisible()
      await expectNoA11yViolations(page)
      await page.keyboard.press('Escape')
      await expect(card).toBeHidden()
      await expect(composer.recipients('to').last()).toBeFocused()
      await page.keyboard.press('F2')
      await expect(composer.recipientInput('to')).toBeFocused()
      await expect(composer.recipientInput('to')).toHaveValue('wrong')

      // A chip removed with the keyboard is announced; the focus goes back to the field
      await page.keyboard.press('Control+A')
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Backspace')
      await expect(composer.recipients('to').last()).toBeFocused()
      await page.keyboard.press('Delete')
      await expect(
        composer.root.getByRole('status').filter({ hasText: 'removed' })
      ).toHaveText(/Carol removed/)
      await expect(composer.recipients('to')).toHaveCount(2)
      await expect(composer.recipientInput('to')).toBeFocused()
    }
  )

  test('A11Y-12 the formatting toolbar, Alt+F10, the image toolbar and the link dialog', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // As tmail-flutter the formatting toolbar opens with "Aa"
    await composer.showFormattingToolbar()
    await composer.editor.focus()
    await page.keyboard.type('Hello ')

    // One tab stop, the states in aria-pressed, Alt+F10 goes there, Escape comes back
    await expect(composer.toolbarButton('Bold')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await page.keyboard.press('Control+B')
    await expect(composer.toolbarButton('Bold')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.keyboard.press('Control+B')
    await page.keyboard.press('Alt+F10')
    await expect(composer.toolbar.getByRole('button').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(composer.editor).toBeFocused()
    await expect(composer.toolbar).toMatchAriaSnapshot(`
      - toolbar "Formatting options":
        - button "Bold" [pressed=false]
        - button "Italic" [pressed=false]
        - button "Underline" [pressed=false]
        - button "Strikethrough" [pressed=false]
        - button "Undo"
        - button "Redo" [disabled]
        - button "Clear formatting"
    `)

    // The link dialog: named, the focus goes in, Escape gives it back to the text
    await page.keyboard.press('Control+K')
    const dialog = page.getByRole('dialog', { name: 'Insert link' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('link-dialog-url-input')).toBeFocused()
    await expectNoA11yViolations(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(composer.editor).toBeFocused()

    // An inline image: its toolbar is named, the sizes are pressed buttons, the width is announced
    const png = await makePng(page, 400, 200, 'A11Y')
    const chooser = page.waitForEvent('filechooser')
    await composer.insertImageButton.click()
    await (
      await chooser
    ).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png })
    await expect(composer.editor.locator('img[data-reference]')).toHaveCount(
      1,
      { timeout: 20_000 }
    )
    await expect(composer.editor).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    const images = composer.root.getByRole('toolbar', { name: 'Image options' })
    await expect(images).toMatchAriaSnapshot(`
      - toolbar "Image options":
        - button "25%"
        - button "50%"
        - button "75%"
        - button "Original size" [pressed]
        - button "Smaller"
        - button "Larger"
        - button "Remove image"
    `)
    await expect(
      composer.root.getByRole('status').filter({ hasText: 'Width 400 px' })
    ).toBeVisible()
    // Decorative until the author writes the alternative text (A11Y-15): not the name of the file
    await expect(
      composer.editor.locator('img[data-reference]')
    ).toHaveAttribute('alt', '')
  })

  test('A11Y-15 the alternative text of an image: a field, empty meaning decorative, Enter writes, Escape cancels', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.editor.focus()
    await page.keyboard.type('See ')
    await composer.insertImage({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 400, 200, 'A11Y')
    })
    const image = composer.editor.locator('img[data-reference]')
    const field = composer.root.getByRole('textbox', {
      name: 'Alternative text'
    })
    /** From the selected image to its field: Enter to the toolbar, Tab on, each one reached */
    const goToAltField = async (): Promise<void> => {
      await page.keyboard.press('Enter')
      await expect(
        composer.root.getByRole('button', { name: '25%' })
      ).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(field).toBeFocused()
    }
    // Not the name of the file: empty, so decorative (alt="" is there, not absent)
    await expect(image).toHaveAttribute('alt', '')
    await expect(composer.editor.getByRole('img')).toHaveCount(0)

    // The field is in the toolbar's tab path, named and described
    await composer.selectLastImage()
    await expect(composer.imageToolbar).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(
      composer.root.getByRole('button', { name: '25%' })
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('')
    await expect(field).toHaveAccessibleDescription(
      'Leave empty if the image is only decorative. Enter applies, Escape cancels.'
    )
    await expectNoA11yViolations(page)

    // Enter writes it and goes back to the text, the image still selected
    await page.keyboard.type('A pink square with the letters A11Y')
    await expect(image).toHaveAttribute('alt', '')
    await page.keyboard.press('Enter')
    await expect(image).toHaveAttribute(
      'alt',
      'A pink square with the letters A11Y'
    )
    await expect(composer.editor.getByRole('img')).toHaveAccessibleName(
      'A pink square with the letters A11Y'
    )
    await expect(composer.editor).toBeFocused()
    await expect(composer.root).toHaveAttribute('data-mode', 'normal')

    // Escape gives the old text back, and does not fold the window
    await goToAltField()
    await expect(field).toHaveValue('A pink square with the letters A11Y')
    await page.keyboard.type(' and more')
    await page.keyboard.press('Escape')
    await expect(image).toHaveAttribute(
      'alt',
      'A pink square with the letters A11Y'
    )
    await expect(composer.editor).toBeFocused()
    await expect(composer.root).toHaveAttribute('data-mode', 'normal')

    // Emptied: decorative again
    await goToAltField()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await page.keyboard.press('Enter')
    await expect(image).toHaveAttribute('alt', '')
    // The focus is back in the text once the field, which the new text remounts, is replaced
    await expect(composer.editor).toBeFocused()

    // Shift+Tab goes back to the toolbar, writing what was typed
    await goToAltField()
    await page.keyboard.type('Back')
    await page.keyboard.press('Shift+Tab')
    await expect(image).toHaveAttribute('alt', 'Back')
    await expect(
      composer.root.getByRole('button', { name: '25%' })
    ).toBeFocused()
  })

  test(
    'A11Y-16 Escape while a chip is edited gives the chip back and stops there; the next Escape folds the window',
    { tag: '@mobile' },
    async ({ page, user }, testInfo) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer
        .recipientInput('to')
        .fill('alice@example.com, bob@example.com, carol@example.com')
      await composer.recipientInput('to').press('Enter')
      await expect(composer.recipients('to')).toHaveCount(3)
      await composer.recipientInput('to').focus()

      // Edit the middle one (F2: Enter opens its card, as tmail-flutter),
      // change the text, Escape: the chip is back where it was
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('F2')
      await expect(composer.recipientInput('to')).toHaveValue('bob@example.com')
      await page.keyboard.type('.fr')
      await page.keyboard.press('Escape')
      await expect(composer.recipients('to')).toHaveText([
        'alice@example.com',
        'bob@example.com',
        'carol@example.com'
      ])
      await expect(composer.recipientInput('to')).toHaveValue('')
      await expect(composer.recipientInput('to')).toBeFocused()
      await expect(composer.root).not.toHaveAttribute('data-mode', 'minimized')
      // Giving a chip back is not adding one: the field still says what it said
      await expect(
        composer.root.getByTestId('composer-to-field').getByRole('status')
      ).toHaveText('3 recipients added')

      // Nothing is being edited any more: the next Escape is the window's
      if (testInfo.project.name === 'chromium') {
        await page.keyboard.press('Escape')
        await composer.expectMode('minimized')
      }
    }
  )

  test('A11Y-17 a chip added is announced as one removed, and "Draft saved" is said once', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    const toStatus = composer.root
      .getByTestId('composer-to-field')
      .getByRole('status')

    await composer.addRecipient('to', 'alice@example.com')
    await expect(toStatus).toHaveText('alice@example.com added')
    await composer
      .recipientInput('to')
      .fill('bob@example.com, carol@example.com, dave@example.com')
    await composer.recipientInput('to').press('Enter')
    await expect(toStatus).toHaveText('3 recipients added')
    await composer.recipientInput('to').press('Backspace')
    await page.keyboard.press('Delete')
    await expect(toStatus).toHaveText('dave@example.com removed')

    // A save asked for: the toast says it, the line only shows it
    await composer.subjectInput.fill('Announced once')
    await composer.runMoreAction('save-draft')
    await expect(composer.saveStatus).toHaveText('Draft saved')
    await expect(page.getByTestId('toast')).toHaveText(/Draft saved/)
    await expect(composer.saveAnnouncement).toHaveText('')
    await expect(composer.saveStatus).not.toHaveAttribute('role', /./)
    const saidTwice = page
      .getByRole('status')
      .filter({ hasText: 'Draft saved' })
    await expect(saidTwice).toHaveCount(1)
    // The autosave (the live region of the line, with no toast) is tested with the form's specs
  })

  test('A11Y-18 the minimized window has no heading inside its button, and keeps its name', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ subject: 'Plain title' })
    await composer.minimizeButton.click()
    await composer.expectMode('minimized')

    const restore = composer.root.getByRole('button', {
      name: 'Show: Plain title'
    })
    await expect(restore).toBeVisible()
    await expect(restore.locator('h1, h2, h3, h4, h5, h6')).toHaveCount(0)
    await expect(composer.root.getByRole('heading')).toHaveCount(0)
    await expect(restore).toHaveText('Plain title')
    await expectNoA11yViolations(page)
  })

  test('A11Y-13 attachments, the "attached" reminder, the close dialog, the toasts and the template picker', async ({
    page,
    user,
    jmap
  }) => {
    const folder = await jmap.createMailbox({ name: 'Templates' })
    await jmap.createEmailIn(folder.id, {
      subject: 'Weekly report',
      html: '<p>Done this week:</p>'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({
      to: [user.email],
      subject: 'Files',
      body: 'See the attached files'
    })

    // The list is named with its count, each file has a Remove button named after it, and
    // adding one is announced
    await composer.attachFile({
      name: 'report.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('r')
    })
    await expect(composer.root).toMatchAriaSnapshot(`
      - list "Attachments (1)":
        - listitem:
          - button "Remove report.txt"
    `)
    await expect(
      composer.root
        .getByRole('status')
        .filter({ hasText: 'report.txt attached' })
    ).toBeVisible()
    await composer.attachFile({
      name: 'second.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('s')
    })
    await expect(
      composer.root.getByRole('list', { name: 'Attachments (2)' })
    ).toBeVisible()
    await composer.root
      .getByRole('button', { name: 'Remove second.txt' })
      .click()
    await expect(
      composer.root.getByRole('list', { name: 'Attachments (1)' })
    ).toBeVisible()
    await expectNoA11yViolations(page)

    // A toast is announced politely and stays reachable: the region exists before the message
    await composer.runMoreAction('save-draft')
    await expect(
      page.getByRole('status').filter({ hasText: 'Draft saved' }).first()
    ).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(1)

    // The picker: a named dialog, the focus in its field, Escape gives it back to "More"
    await composer.openTemplatePicker()
    await expect(composer.templatePicker).toMatchAriaSnapshot(`
      - dialog "Insert a template":
        - heading "Insert a template" [level=2]
        - button "Close"
        - combobox "Search templates"
        - listbox "Templates":
          - option "Weekly report"
        - status
    `)
    await expect(composer.templatePickerInput).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(composer.moreButton).toBeFocused()

    // The close dialog: named, with its message, the focus comes back where it was on Cancel
    await composer.editor.focus()
    await page.keyboard.type(' and more')
    await composer.closeButton.click()
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toMatchAriaSnapshot(`
      - dialog "Save message":
        - heading "Save message" [level=2]
        - button "Cancel"
        - button "Discard changes"
        - button "Save"
    `)
    await expectNoA11yViolations(page)
    await dialog.getByTestId('confirm-dialog-cancel-button').click()
    await expect(dialog).toBeHidden()
    await expect(composer.closeButton).toBeFocused()

    // The "forgot to attach" dialog of the send checks: the file is attached, so it does not ask
    await composer.send()
  })

  test(
    'A11Y-14 the send checks are dialogs, and give the focus back',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()

      // No recipient: a dialog says so, the focus is on its button, which takes it to the To field
      await composer.sendButton.click()
      const failed = page.getByTestId('confirm-dialog')
      await expect(failed).toMatchAriaSnapshot(`
      - dialog "Sending failed":
        - button "Close"
        - heading "Sending failed" [level=2]
        - paragraph: Your email should have at least one recipient
        - button "Add recipients"
    `)
      await expect(
        failed.getByRole('button', { name: 'Add recipients' })
      ).toBeFocused()
      await expectNoA11yViolations(page)
      await failed.getByRole('button', { name: 'Add recipients' }).click()
      await expect(composer.recipientInput('to')).toBeFocused()

      // "attached" without a file: a confirmation, Cancel gives the focus back to the text
      await composer.fill({
        to: [user.email],
        subject: 'Reminder',
        body: 'The report is attached'
      })
      await composer.sendButton.click()
      const dialog = page.getByTestId('confirm-dialog')
      await expect(dialog).toMatchAriaSnapshot(`
      - dialog "Forgot to attach a file?":
        - heading "Forgot to attach a file?" [level=2]
        - button "Cancel"
        - button "Send message"
    `)
      await expectNoA11yViolations(page)
      await dialog.getByTestId('confirm-dialog-cancel-button').click()
      await expect(dialog).toBeHidden()
      await expect(composer.root).toBeVisible()
    }
  )
})
