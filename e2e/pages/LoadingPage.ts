import { expect, type Locator, type Page } from '@playwright/test'

/** A box on the page, in CSS pixels */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The loading states (skeletons) and the offline banner: the shapes drawn
 * while data is on its way, the one live region saying "Loading", and the
 * banner "No internet connection". Counterparts: none in tmail-flutter's
 * Patrol suite; the banner is `NetworkConnectionBannerWidget` /
 * `NetworkConnectionController`.
 */
export class LoadingPage {
  readonly page: Page
  readonly listSkeleton: Locator
  readonly treeSkeleton: Locator
  readonly readingSkeleton: Locator
  /** The live region saying "Loading" once for the whole page */
  readonly loadingAnnouncement: Locator
  readonly offlineBanner: Locator
  /** The live region saying that the network is gone, or back */
  readonly networkAnnouncement: Locator

  constructor(page: Page) {
    this.page = page
    this.listSkeleton = page.getByTestId('email-list-loading')
    this.treeSkeleton = page.getByTestId('mailbox-tree-loading')
    this.readingSkeleton = page.getByTestId('email-view-loading')
    this.loadingAnnouncement = page.getByTestId('loading-announcement')
    this.offlineBanner = page.getByTestId('offline-banner')
    this.networkAnnouncement = page.getByTestId('network-announcement')
  }

  /** The box of a locator, once it is on the page */
  async box(locator: Locator): Promise<Box> {
    const box = await locator.boundingBox()
    if (box === null) throw new Error('The element has no box')
    return box
  }

  /** The first row of the skeleton of the list */
  get firstSkeletonRow(): Locator {
    return this.listSkeleton.locator('tbody tr').first()
  }

  /** The first row of a list of emails */
  firstRow(list: Locator): Locator {
    return list.getByTestId('email-list-item').first()
  }

  /** Whether an element is hidden from the accessibility tree */
  async isHiddenToScreenReaders(locator: Locator): Promise<boolean> {
    return locator.evaluate(element => {
      for (
        let node: Element | null = element;
        node !== null;
        node = node.parentElement
      ) {
        if (node.getAttribute('aria-hidden') === 'true') return true
      }
      return false
    })
  }

  /** The cumulative layout shift of the page since `watchLayoutShift` */
  async layoutShift(): Promise<number> {
    return this.page.evaluate(
      () => (window as unknown as { __cls: number }).__cls
    )
  }

  /** Starts adding up the layout shifts of the page (`layoutShift`) */
  async watchLayoutShift(): Promise<void> {
    await this.page.evaluate(() => {
      const holder = window as unknown as { __cls: number }
      holder.__cls = 0
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          }
          if (!shift.hadRecentInput) holder.__cls += shift.value
        }
      }).observe({ type: 'layout-shift', buffered: false })
    })
  }

  /** Two boxes land on the same place, within `tolerance` pixels */
  expectSameBox(
    actual: Box,
    expected: Box,
    tolerance = 1,
    what = 'box'
  ): void {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(
        Math.abs(actual[key] - expected[key]),
        `${what}: ${key} is ${actual[key]}, expected ${expected[key]}`
      ).toBeLessThanOrEqual(tolerance)
    }
  }
}
