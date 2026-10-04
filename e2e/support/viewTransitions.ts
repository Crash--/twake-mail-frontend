import type { Page } from '@playwright/test'

/**
 * View transitions seen by the page: `watchViewTransitions` counts the
 * calls to `document.startViewTransition` from the next page load on,
 * `removeViewTransitionApi` makes the page a browser without the API.
 */
interface TransitionWindow {
  __viewTransitions?: number
}

export async function watchViewTransitions(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const view: Window & TransitionWindow = window
    view.__viewTransitions = 0
    if (typeof document.startViewTransition !== 'function') return
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = (
      ...args: Parameters<Document['startViewTransition']>
    ): ViewTransition => {
      view.__viewTransitions = (view.__viewTransitions ?? 0) + 1
      return start(...args)
    }
  })
}

export async function viewTransitionCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as Window & TransitionWindow).__viewTransitions ?? 0
  )
}

/** Whether the browser of the page has the View Transitions API */
export async function hasViewTransitionApi(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof document.startViewTransition === 'function')
}

export async function removeViewTransitionApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, 'startViewTransition')
  })
}
