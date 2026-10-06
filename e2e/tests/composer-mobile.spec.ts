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

function isPhone(width: number | undefined): boolean {
  return width !== undefined && width < 600
}

test.describe('CMP: the composer on a phone and a tablet (Figma "Composer", mobile frames)', () => {
  test(
    'CMP-86 on a phone the top bar holds close, then Aa, attach, image, a round Send and More, with no footer',
    { tag: '@mobile' },
    async ({ page, user }) => {
      test.skip(!isPhone(page.viewportSize()?.width), 'phone only')
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await expect(composer.sendButton).toBeVisible()

      // The window has no title bar of its own: the form's bar is the first thing in it
      const close = await boxOf(composer.closeButton)
      const root = await boxOf(composer.root)
      expect(close.y - root.y).toBeLessThan(12)
      const bar = await boxOf(composer.root.getByTestId('composer-top-bar'))
      expect(bar.height).toBe(56)
      expect(bar.width).toBe(root.width)

      const actions = await Promise.all(
        [
          composer.formattingButton,
          composer.attachFileButton,
          composer.insertImageButton,
          composer.sendButton,
          composer.moreButton
        ].map(boxOf)
      )
      // Every target is at least 44 px, from left to right, after the close button
      let previousRight = close.x + close.width
      for (const box of [close, ...actions]) {
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
      for (const box of actions) {
        expect(box.x).toBeGreaterThanOrEqual(previousRight - 1)
        previousRight = box.x + box.width
        // Centred in the bar
        expect(Math.abs(box.y + box.height / 2 - (bar.y + 28))).toBeLessThan(2)
      }
      // The right edge of More is the edge of the bar (4 px of padding)
      const more = actions[4] as Box
      expect(bar.x + bar.width - (more.x + more.width)).toBeLessThanOrEqual(8)

      // Send: a round disc in a 44 px target, filled, with no label
      const send = actions[3] as Box
      expect([send.width, send.height]).toEqual([44, 44])
      expect(await composer.sendButton.innerText()).toBe('')
      expect(
        await composer.sendButton.evaluate(
          element => getComputedStyle(element).borderTopLeftRadius
        )
      ).toBe('100px')
      // No footer: nothing under the editor but the keyboard
      await expect(composer.deleteDraftButton).toHaveCount(0)
      const toolbarState =
        await composer.formattingButton.getAttribute('aria-pressed')
      expect(toolbarState).toBe('false')
      await expect(composer.toolbar).toHaveCount(0)
    }
  )

  test(
    'CMP-87 the formatting toolbar shows on "Aa", scrolls sideways without cutting a group, and nothing overflows the screen',
    { tag: '@mobile' },
    async ({ page, user }) => {
      test.skip(!isPhone(page.viewportSize()?.width), 'phone only')
      const mailbox = await new LoginPage(page).loginAs(user)
      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 740 })
        const composer = await mailbox.compose()
        await composer.showFormattingToolbar()
        expect(await composer.horizontalOverflow()).toEqual({
          page: 0,
          window: 0
        })

        // The toolbar sits at the bottom of the window, over nothing else
        const toolbar = await boxOf(composer.toolbar)
        const root = await boxOf(composer.root)
        expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(
          root.y + root.height + 1
        )

        // Scrolled to its end, the last button is whole and within the screen
        await composer.toolbar.evaluate(element => {
          element.scrollLeft = element.scrollWidth
        })
        const clear = composer.toolbar.getByRole('button').last()
        await expect
          .poll(async () => {
            const box = await boxOf(clear)
            return box.x + box.width <= width
          })
          .toBe(true)
        // A swipe stops on the start of a group (scroll snapping), not in the middle of one
        await composer.toolbar.evaluate(element => {
          element.scrollTo({ left: 0 })
          element.scrollBy({ left: 90 })
        })
        await expect
          .poll(() =>
            composer.toolbar.evaluate(element => {
              const bounds = element.getBoundingClientRect()
              return Array.from(element.children).some(child => {
                const left = child.getBoundingClientRect().left - bounds.left
                return left >= -1 && left <= 17
              })
            })
          )
          .toBe(true)
        await composer.close()
        await expect(composer.root).toBeHidden()
      }
    }
  )

  test(
    'CMP-88 the More menu of a phone holds the actions the bar has no room for, a tablet has no link item',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const phone = isPhone(page.viewportSize()?.width)
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await expect(composer.sendButton).toBeVisible()
      const items = await composer.openMoreMenu()
      const names = (await items.allInnerTexts()).map(text => text.trim())
      expect(names).toEqual(
        phone
          ? [
              'Insert link',
              'Save as draft',
              'Save as template',
              'Request read receipt',
              'Mark as important',
              'Delete draft'
            ]
          : [
              'Save as draft',
              'Save as template',
              'Request read receipt',
              'Mark as important'
            ]
      )
    }
  )

  test(
    'CMP-89 a tablet shows the composer as a window: 772 px wide, 710 high, the title centred, minimize, expand and close at the end',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const width = page.viewportSize()?.width ?? 0
      test.skip(width < 600 || width >= 900, 'tablet only')
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.expectMode('normal')
      const root = await boxOf(composer.root)
      expect([root.width, root.height]).toEqual([width - 48, 710])
      expect(root.x).toBe(24)
      const title = await boxOf(composer.title)
      const middle = title.x + title.width / 2
      expect(Math.abs(middle - (root.x + root.width / 2))).toBeLessThan(2)
      const buttons = await Promise.all(
        [
          composer.minimizeButton,
          composer.fullscreenButton,
          composer.closeButton
        ].map(boxOf)
      )
      for (const box of buttons) {
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.x).toBeGreaterThan(middle)
      }
      expect(await composer.horizontalOverflow()).toEqual({
        page: 0,
        window: 0
      })
      // Minimized, the page is usable again
      await composer.minimizeButton.click()
      await composer.expectMode('minimized')
    }
  )

  test(
    'CMP-90 long addresses in To keep the input on the row of the last chip while room is left, and leave no empty row',
    { tag: '@mobile' },
    async ({ page, user }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await expect(composer.sendButton).toBeVisible()
      for (const email of [
        'a-very-long-first-address-for-testing-wrapping@example-long-domain-name.org',
        'another.quite.long.address.for.the.second.chip@subdomain.example-long-domain.org',
        'third.long.address.that.fills.the.row@example.com',
        'short@example.com'
      ]) {
        await composer.addRecipient('to', email)
      }
      const label = composer.root
        .getByTestId('composer-to-field')
        .locator('label')
      const chips = composer.recipients('to')
      const first = await boxOf(chips.first())
      // The label keeps the first chip company, never alone on a row
      expect(Math.abs((await boxOf(label)).y - first.y)).toBeLessThan(8)
      const last = await boxOf(chips.last())
      const input = await boxOf(composer.recipientInput('to'))
      const field = await boxOf(composer.root.getByTestId('composer-to-field'))
      // What the row of the last chip has left, up to the buttons of the line
      const rightEdge = await composer
        .recipientInput('to')
        .evaluate(element => {
          let content = element.parentElement
          while (
            content !== null &&
            !content.className.includes('u-flex-auto')
          ) {
            content = content.parentElement
          }
          return content === null ? 0 : content.getBoundingClientRect().right
        })
      const room = rightEdge - (last.x + last.width) - 4
      if (room >= 56) {
        expect(
          Math.abs(input.y + input.height / 2 - (last.y + last.height / 2))
        ).toBeLessThan(8)
      } else {
        // No room: the input takes the row under the chips and ends the field
        expect(input.y).toBeGreaterThan(last.y + last.height - 4)
        expect(field.y + field.height - (input.y + input.height)).toBeLessThan(
          16
        )
      }
    }
  )
})
