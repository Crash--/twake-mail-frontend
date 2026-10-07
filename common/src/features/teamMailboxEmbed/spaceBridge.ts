import {
  connectToTwakeSpace,
  embedRoute,
  overlayRegionMessage,
  type OverlayRegion
} from '@linagora/twake-embed'

import { replaceWith } from '@common/utils/navigation'

import {
  parseTeamMailboxEmbedPath,
  TEAM_MAILBOX_EMBED_PREFIX,
  type TeamMailboxEmbedTarget
} from './teamMailboxEmbedPath'

/** What the facade of a team mailbox tells TwakeSpace, around its frame */
export interface SpaceBridge {
  /**
   * TwakeSpace owns the history of the page, the frame has none: from now
   * on `pushState` replaces the entry of the frame, and every change of its
   * URL is sent to TwakeSpace, the initial one too. `applyNavigation` shows
   * a path under the base of the facade (a `twake-embed:navigate` of
   * TwakeSpace), without reporting the URL it writes. Returns the function
   * that stops all this.
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

function isTeamMailboxId(id: string): boolean {
  return (
    parseTeamMailboxEmbedPath(
      TEAM_MAILBOX_EMBED_PREFIX + encodeURIComponent(id)
    )?.rootId === id
  )
}

/**
 * The bridge to TwakeSpace (the contract of `@linagora/twake-embed`), null
 * outside a frame. The facade does not know where TwakeSpace is: it posts
 * nothing until TwakeSpace greets the frame, then talks to the origin of that
 * greeting only. `frame-ancestors` says who may frame the facade.
 */
export function connectToSpace(
  _target: TeamMailboxEmbedTarget
): SpaceBridge | null {
  const connection = connectToTwakeSpace({
    embedPrefix: TEAM_MAILBOX_EMBED_PREFIX,
    isResourceId: isTeamMailboxId
  })
  if (connection === null) return null

  return {
    syncHistory: applyNavigation =>
      connection.syncHistory({
        onNavigate: (_id, path) =>
          applyNavigation(path.startsWith('/') ? path : `/${path}`),
        onLoad: (id, path) => {
          replaceWith(embedRoute(TEAM_MAILBOX_EMBED_PREFIX, id) + path)
        }
      }),
    notifyLoginRequired: () => {
      connection.notifyLoginRequired()
    }
  }
}

/**
 * Tells the page framing the facade the region of the overlay over its page
 * the facade draws in: it shows that part only, the rest of its page keeps its
 * clicks. Any page: the region is only boxes of the layout, and
 * `frame-ancestors` already says who may frame the facade, so the overlay
 * needs no origin.
 */
export function reportOverlayRegion(region: OverlayRegion): void {
  window.parent.postMessage(overlayRegionMessage(region), '*')
}
