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
