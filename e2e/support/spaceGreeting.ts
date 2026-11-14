import type { Page } from '@playwright/test'

/**
 * Names the fake TwakeSpace as the host the facade talks to: the page that
 * frames it is served on the origin of the app, which `TWAKE_SPACE_URL` of a
 * deployment would name. Set before the facade reads its configuration.
 */
export async function nameSpaceHost(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as Window & { TWAKE_SPACE_URL?: string }).TWAKE_SPACE_URL =
      location.origin
  })
}

/**
 * Script of a fake TwakeSpace page: greets the frame of the facade on each of
 * its loads, and when the frame says it is ready. To put before the iframe, so
 * that the listener is there when the frame says it first.
 */
export const SPACE_GREETING_SCRIPT = `<script>
const hello = { type: 'twake-embed:hello' }
addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'twake-embed:ready') return
  event.source.postMessage(hello, event.origin)
})
addEventListener('DOMContentLoaded', () => {
  document.querySelector('iframe').addEventListener('load', event => {
    event.target.contentWindow.postMessage(hello, location.origin)
  })
})
</script>`
