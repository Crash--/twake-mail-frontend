import { CozyBridge } from 'cozy-external-bridge'

/**
 * Message to TwakeSpace when the bridge has no `notifyLoginRequired` yet
 * (cozy-external-bridge 1.3)
 */
export const LOGIN_REQUIRED_MESSAGE = {
  type: 'twake-embed:login-required'
} as const

/** What the facade of a team mailbox tells TwakeSpace, around its frame */
export interface SpaceBridge {
  /**
   * Sends every navigation of the facade to TwakeSpace (`updateHistory`),
   * which writes it in its own address; returns the function that stops
   */
  syncHistory: () => () => void
  /**
   * The session expired and the silent login cannot show the SSO portal in
   * the frame: TwakeSpace signs the user in again, then reloads its frames
   */
  notifyLoginRequired: () => void
}

interface LoginRequiredMethod {
  notifyLoginRequired: () => Promise<void>
}

function hasLoginRequiredMethod(
  bridge: CozyBridge
): bridge is CozyBridge & LoginRequiredMethod {
  return (
    'notifyLoginRequired' in bridge &&
    typeof bridge.notifyLoginRequired === 'function'
  )
}

/**
 * The bridge to TwakeSpace (cozy-external-bridge, as with Twake Workplace),
 * null outside a frame or without `TWAKE_SPACE_URL`: the bridge only talks
 * to that origin.
 */
export function connectToSpace(spaceOrigin: string | null): SpaceBridge | null {
  if (spaceOrigin === null) return null
  const bridge = new CozyBridge()
  if (!bridge.isInIframe() || !bridge.setupBridge(spaceOrigin)) return null

  return {
    syncHistory: () => {
      bridge.startHistorySyncing()
      return bridge.stopHistorySyncing
    },
    notifyLoginRequired: () => {
      if (hasLoginRequiredMethod(bridge)) {
        bridge.notifyLoginRequired().catch((error: unknown) => {
          console.warn('[embed] TwakeSpace was not told to sign in', error)
        })
        return
      }
      window.parent.postMessage(LOGIN_REQUIRED_MESSAGE, spaceOrigin)
    }
  }
}
