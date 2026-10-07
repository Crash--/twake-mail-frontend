import { CozyBridge } from 'cozy-external-bridge'

import { overlayRegionMessage, type OverlayRegion } from '@linagora/twake-mui'

import { replaceWith } from '@common/utils/navigation'

import {
  parseTeamMailboxEmbedPath,
  TEAM_MAILBOX_EMBED_PREFIX,
  type TeamMailboxEmbedTarget
} from './teamMailboxEmbedPath'

/**
 * Message to TwakeSpace when the bridge has no `notifyLoginRequired` yet
 * (cozy-external-bridge 1.3)
 */
export const LOGIN_REQUIRED_MESSAGE = {
  type: 'twake-embed:login-required'
} as const

/** Every change of the URL of the facade, for TwakeSpace's own history */
export const PATH_MESSAGE = 'twake-embed:path'

/** TwakeSpace asks to show a mailbox, without a reload when the app can */
export const LOAD_MESSAGE = 'twake-embed:load'

/** TwakeSpace applies Back, Forward or a deep link within the mailbox */
export const NAVIGATE_MESSAGE = 'twake-embed:navigate'

/** What the facade of a team mailbox tells TwakeSpace, around its frame */
export interface SpaceBridge {
  /**
   * TwakeSpace owns the history of the page, the frame has none: from now
   * on `pushState` replaces the entry of the frame, and every change of its
   * URL is sent to TwakeSpace (`twake-embed:path`), the initial one too.
   * `applyNavigation` shows a path under the base of the facade (a
   * `twake-embed:navigate` of TwakeSpace), without reporting the URL it
   * writes. Returns the function that stops all this.
   */
  syncHistory: (
    applyNavigation: (path: string) => void | Promise<void>
  ) => () => void
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
 * A path under the embed route: '' or starting with '/', '?' or '#', and
 * not leading out of it
 */
export function isEmbedPath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  if (path !== '' && !/^[/?#]/.test(path)) return false
  return !path.startsWith('//') && !path.includes('..') && !path.includes('\\')
}

/** The URL of the frame below the base of the facade, null outside it */
function getPathBelow(basename: string): string | null {
  const { pathname, search, hash } = window.location
  if (pathname !== basename && !pathname.startsWith(`${basename}/`)) {
    return null
  }
  return `${pathname.slice(basename.length)}${search}${hash}`
}

/**
 * The bridge to TwakeSpace (ADR 010 of twake-space-architecture: raw
 * messages, checked on both sides), null outside a frame or without
 * `TWAKE_SPACE_URL`: the facade only talks to that origin.
 */
export function connectToSpace(
  spaceOrigin: string | null,
  target: TeamMailboxEmbedTarget
): SpaceBridge | null {
  if (spaceOrigin === null) return null
  const bridge = new CozyBridge()
  if (!bridge.isInIframe() || !bridge.setupBridge(spaceOrigin)) return null

  const { basename, rootId } = target
  let isApplying = false

  const reportPath = (replace: boolean): void => {
    const path = getPathBelow(basename)
    if (isApplying || path === null) return
    window.parent.postMessage(
      { type: PATH_MESSAGE, resourceId: rootId, path, replace },
      spaceOrigin
    )
  }

  const applyNavigate = async (
    path: string,
    applyNavigation: (path: string) => void | Promise<void>
  ): Promise<void> => {
    isApplying = true
    try {
      await applyNavigation(path.startsWith('/') ? path : `/${path}`)
    } finally {
      isApplying = false
    }
  }

  return {
    syncHistory: applyNavigation => {
      // Called back on `window.history`, restored as they were
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { pushState, replaceState } = window.history
      window.history.pushState = function (...args) {
        replaceState.apply(window.history, args)
        reportPath(false)
      }
      window.history.replaceState = function (...args) {
        replaceState.apply(window.history, args)
        reportPath(true)
      }

      const handleMessage = (event: MessageEvent): void => {
        if (event.origin !== spaceOrigin || event.source !== window.parent) {
          return
        }
        const data: unknown = event.data
        if (typeof data !== 'object' || data === null) return
        const { type, resourceId, path } = data as Record<string, unknown>
        if (typeof resourceId !== 'string' || !isEmbedPath(path)) return

        if (type === NAVIGATE_MESSAGE && resourceId === rootId) {
          void applyNavigate(path, applyNavigation)
        } else if (
          type === LOAD_MESSAGE &&
          parseTeamMailboxEmbedPath(TEAM_MAILBOX_EMBED_PREFIX + resourceId)
            ?.rootId === resourceId
        ) {
          replaceWith(
            `${TEAM_MAILBOX_EMBED_PREFIX}${encodeURIComponent(resourceId)}${path}`
          )
        }
      }
      window.addEventListener('message', handleMessage)

      // The router wrote its first URL before this starts
      reportPath(true)

      return () => {
        window.removeEventListener('message', handleMessage)
        window.history.pushState = pushState
        window.history.replaceState = replaceState
      }
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

/**
 * Tells the page framing the facade the region of the overlay over its page
 * the facade draws in: it shows that part only, the rest of its page keeps its
 * clicks. Any page: the region is only boxes of the layout, and
 * `frame-ancestors` already says who may frame the facade, so the overlay
 * works without `TWAKE_SPACE_URL`.
 */
export function reportOverlayRegion(region: OverlayRegion): void {
  window.parent.postMessage(overlayRegionMessage(region), '*')
}
