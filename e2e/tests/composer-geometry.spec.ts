import type { Locator } from '@playwright/test'

import { LoginPage } from '../pages'
import { expect, test } from '../support/fixtures'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Not visible')
  return box
}

async function styleOf(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property
  )
}

test.describe('CMP: geometry of the composer (Figma "Composer_open_dialog_default")', () => {
  test('CMP-84 the window, title bar, fields, toolbar and footer have the measures of the design', async ({
    page,
    user
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop geometry')
    await page.setViewportSize({ width: 1440, height: 900 })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // As tmail-flutter the formatting toolbar opens with "Aa"
    await composer.showFormattingToolbar()
    await expect(composer.toolbar).toBeVisible()

    const root = await boxOf(composer.root)
    expect([root.width, root.height]).toEqual([790, 634])
    expect(await styleOf(composer.root, 'border-top-left-radius')).toBe('8px')

    // Title bar: 44 px high, three 40 px buttons 4 px apart
    const to = await boxOf(composer.root.getByTestId('composer-to-field'))
    expect(to.y - root.y).toBe(44)
    expect(to.height).toBe(37)
    const header = await Promise.all(
      [
        composer.minimizeButton,
        composer.fullscreenButton,
        composer.closeButton
      ].map(boxOf)
    )
    for (const box of header) {
      expect([box.width, box.height]).toEqual([40, 40])
    }
    const [minimize, expand, close] = header as [Box, Box, Box]
    expect(expand.x - (minimize.x + 40)).toBe(4)
    expect(close.x - (expand.x + 40)).toBe(4)
    expect(root.x + root.width - (close.x + 40)).toBe(16)

    // Formatting toolbar: 40 px under a 1 px rule, boxes 32 px high, 8 px apart
    const toolbar = await boxOf(composer.toolbar)
    expect(toolbar.height).toBe(41)
    const controls = await Promise.all(
      ['Text style Normal', 'Text Size 14', 'Text Color'].map(name =>
        boxOf(composer.root.getByRole('button', { name }))
      )
    )
    for (const box of controls) expect(box.height).toBe(32)
    const [first, second] = controls as [Box, Box, Box]
    expect(second.x - (first.x + first.width)).toBe(8)
    const bold = await boxOf(composer.toolbarButton('Bold'))
    expect(bold.height).toBe(28)
    // The B I U S group: one 114 x 32 box
    const group = await boxOf(composer.toolbarButton('Bold').locator('..'))
    expect([group.width, group.height]).toEqual([114, 32])

    // Footer: 16 px padding, 40 px icon buttons 8 px apart, Send 128 x 40 pill
    const footer = await Promise.all(
      [
        composer.formattingButton,
        composer.attachFileButton,
        composer.insertImageButton,
        composer.root.getByTestId('rich-text-link-button')
      ].map(boxOf)
    )
    for (const box of footer) expect([box.width, box.height]).toEqual([40, 40])
    const [formatting, attach, image, link] = footer as [Box, Box, Box, Box]
    expect(attach.x - (formatting.x + 40)).toBe(8)
    expect(image.x - (attach.x + 40)).toBe(8)
    expect(link.x - (image.x + 40)).toBe(8)
    expect(formatting.x - root.x).toBe(16)
    const send = await boxOf(composer.sendButton)
    expect([send.width, send.height]).toEqual([128, 40])
    expect(await styleOf(composer.sendButton, 'border-top-left-radius')).toBe(
      '100px'
    )
    expect(root.x + root.width - (send.x + send.width)).toBe(16)
    expect(root.y + root.height - (send.y + send.height)).toBe(16)
    expect(send.y - (toolbar.y + toolbar.height)).toBe(16)
  })

  test(
    'CMP-85 the footer icon buttons are 40 px (44 on touch) round buttons, the toolbar boxes 32 px high (44 on touch), at every width',
    { tag: '@mobile' },
    async ({ page, user }, testInfo) => {
      // Touch screens enlarge the targets to 44 px (docs/accessibility.md)
      const size = testInfo.project.name === 'chromium' ? 40 : 44
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.showFormattingToolbar()
      for (const button of [
        composer.closeButton,
        composer.formattingButton,
        composer.attachFileButton,
        composer.insertImageButton,
        composer.moreButton
      ]) {
        const box = await boxOf(button)
        expect([box.width, box.height]).toEqual([size, size])
        expect(await styleOf(button, 'border-top-left-radius')).toBe('50%')
      }
      const style = await boxOf(composer.toolbarButton('Text style Normal'))
      expect(style.height).toBe(size === 40 ? 32 : 44)
      const toolbar = await boxOf(composer.toolbar)
      if (size === 40) expect(toolbar.height).toBe(41)
      else expect(toolbar.height).toBeGreaterThanOrEqual(53)
    }
  )

  test(
    'CMP-100 with 200 recipients the chips scroll in a field of 3 rows, and the body keeps its height',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      const addresses = (prefix: string): string =>
        Array.from(
          { length: 200 },
          (_, index) => `${prefix}${index}@example.com`
        ).join(', ')
      const to = composer.root.getByTestId('composer-to-field')
      // The area the message is written in: the scrolling ancestor of the editing area
      const body = async (): Promise<Box> =>
        composer.editor.evaluate(element => {
          let area: HTMLElement | null = element.parentElement
          while (
            area !== null &&
            !['auto', 'scroll'].includes(getComputedStyle(area).overflowY)
          ) {
            area = area.parentElement
          }
          const box = (area ?? element).getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width, height: box.height }
        })

      const before = await body()
      await composer.recipientInput('to').fill(addresses('to'))
      await composer.recipientInput('to').press('Enter')
      await expect(composer.recipients('to')).toHaveCount(200)

      // Three rows of 32 px chips, 4 px apart, then the field scrolls inside
      const chips = composer.recipients('to')
      const content = chips.first().locator('..')
      expect((await boxOf(content)).height).toBeLessThanOrEqual(104)
      expect(
        await content.evaluate(element => element.scrollHeight)
      ).toBeGreaterThan(104)
      expect(await styleOf(content, 'overflow-y')).toBe('auto')
      // The window gave the body about what it had: the field grew by 2 rows at most
      const after = await body()
      expect(before.height - after.height).toBeLessThanOrEqual(80)
      expect(after.height).toBeGreaterThanOrEqual(120)

      // The input at the end stays in view while typing; the focused chip follows the keys
      await composer.recipientInput('to').focus()
      await page.keyboard.press('Backspace')
      const last = chips.last()
      await expect(last).toBeFocused()
      const within = async (locator: Locator): Promise<boolean> => {
        const [inner, outer] = [await boxOf(locator), await boxOf(content)]
        return (
          inner.y >= outer.y - 1 &&
          inner.y + inner.height <= outer.y + outer.height + 1
        )
      }
      expect(await within(last)).toBe(true)
      for (let step = 0; step < 150; step += 1) {
        await page.keyboard.press('ArrowLeft')
      }
      await expect(chips.nth(49)).toBeFocused()
      expect(await within(chips.nth(49))).toBe(true)
      await composer.recipientInput('to').focus()
      expect(await within(composer.recipientInput('to'))).toBe(true)

      // Cc and Bcc as full as To: the body is still there
      for (const field of ['cc', 'bcc'] as const) {
        await composer.showField(field)
        await composer.recipientInput(field).fill(addresses(field))
        await composer.recipientInput(field).press('Enter')
        await expect(composer.recipients(field)).toHaveCount(200)
        expect(
          (await boxOf(composer.root.getByTestId(`composer-${field}-field`)))
            .height
        ).toBeLessThanOrEqual(120)
      }
      expect((await boxOf(to)).height).toBeLessThanOrEqual(120)
      // 600 recipients in three fields, on a 720 px high desktop screen: 91 px at the worst
      const full = await body()
      expect(full.height).toBeGreaterThanOrEqual(80)
    }
  )
})
