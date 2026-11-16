import type { Locator, Page } from '@playwright/test'

/** A finger held on an element (`useLongPress`: a touch pointer down for 500 ms) */
export async function longPress(page: Page, target: Locator): Promise<void> {
  // Resolved once: the menu that opens hides the row from its role queries
  const element = await target.elementHandle()
  const box = await element?.boundingBox()
  if (element === null || box === null || box === undefined) {
    throw new Error('long press on an element out of view')
  }
  const at = {
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2
  }
  await element.dispatchEvent('pointerdown', at)
  await page.waitForTimeout(600)
  await element.dispatchEvent('pointerup', at)
}
