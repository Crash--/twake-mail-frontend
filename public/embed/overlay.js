// Handshake of the overlay frame with TwakeSpace, in the Open Buro intent
// lifecycle: `intent:ready` until TwakeSpace answers `intent:init`, then the
// region the app draws in goes back as `twake-surface:region`.
// The app reaches this window as `window.parent.frames['<its name>:overlay']`.
;(function () {
  'use strict'
  var PROTOCOL = 'twake-surface/1'
  var origin = null
  try {
    origin = window.TWAKE_SPACE_URL
      ? new URL(window.TWAKE_SPACE_URL).origin
      : null
  } catch (error) {
    origin = null
  }
  if (origin === null || window.parent === window) return

  var intentId = null
  var resolveReady
  var surface = {
    intentId: null,
    ready: new Promise(function (resolve) {
      resolveReady = resolve
    }),
    // 'full', or a list of { x, y, width, height } in CSS px of this window
    setRegion: function (region) {
      if (intentId === null) return
      window.parent.postMessage(
        {
          type: 'twake-surface:region',
          intentId: intentId,
          payload: { region: region }
        },
        origin
      )
    }
  }
  window.twakeSurface = surface

  window.addEventListener('message', function (event) {
    if (
      intentId !== null ||
      event.source !== window.parent ||
      event.origin !== origin
    )
      return
    var data = event.data
    if (
      !data ||
      data.type !== 'intent:init' ||
      typeof data.intentId !== 'string'
    )
      return
    if (!data.payload || data.payload.protocol !== PROTOCOL) {
      window.parent.postMessage(
        {
          type: 'intent:error',
          intentId: data.intentId,
          payload: { code: 'unsupported_protocol' }
        },
        origin
      )
      return
    }
    intentId = data.intentId
    surface.intentId = intentId
    resolveReady()
  })

  // TwakeSpace may not listen yet: say it again until it answers
  var attempts = 0
  ;(function announce() {
    if (intentId !== null || attempts++ >= 20) return
    window.parent.postMessage({ type: 'intent:ready' }, origin)
    setTimeout(announce, 500)
  })()
})()
