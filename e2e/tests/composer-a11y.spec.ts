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
    await expect(composer.root).toMatchAriaSnapshot(`
      - dialog "New message":
        - heading "New message" [level=2]
        - button "Minimize"
        - button "Fullscreen"
        - button "Save & close"
        - group "To":
          - combobox "To"
        - textbox "Subject"
        - textbox "Message body"
        - toolbar "Formatting options"
        - status
        - button "Attach file"
        - button "Insert image"
        - button "Insert link"
        - button "Insert emoji"
        - status
        - button "Delete draft"
        - button "More"
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
      'Text style Normal',
      'Formatting options',
      'Attach file',
      'Insert image',
      'Insert link',
      'Insert emoji',
      'Delete draft',
      'More',
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
        - button "Save & close"
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
        'Delete removes the address, Enter edits it.'
      )
      // Not by colour alone: the invalid one is named so, and outlined with a warning icon
      await expect(composer.recipients('to').last()).toHaveAttribute(
        'data-invalid',
        'true'
      )
      await expectNoA11yViolations(page)

      // Backspace reaches the last chip with the focus; Enter edits it in the field
      await page.keyboard.press('Backspace')
      await expect(composer.recipients('to').last()).toBeFocused()
      await page.keyboard.press('Enter')
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
    // The alternative text is the name of the file: the grid tracks it
    await expect(composer.editor.getByRole('img')).toHaveAccessibleName(
      'photo.png'
    )
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
