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
      await expect(composer.toolbar).toBeVisible()
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
})
