import {
  connectToTwakeSpace,
  embedRoute,
  overlayRegionMessage,
  type Badge,
  type OverlayRegion
} from '@linagora/twake-embed'

import {
  parseTeamMailboxEmbedPath,
  TEAM_MAILBOX_EMBED_PREFIX,
  type TeamMailboxEmbedTarget
} from './teamMailboxEmbedPath'

/** What TwakeSpace asks the facade to show */
export interface SpaceNavigation {
  /** A path under the base of the facade (a `twake-embed:navigate`) */
  navigate: (path: string) => void | Promise<void>
  /**
   * Another team mailbox (a `twake-embed:load`), already in the address:
   * the facade shows it in the same document, its folders and its session
   * kept, so the counts it reports never go away
   */
  load: (target: TeamMailboxEmbedTarget) => void
}

/** What the facade of a team mailbox tells TwakeSpace, around its frame */
export interface SpaceBridge {
  /**
   * TwakeSpace owns the history of the page, the frame has none: from now
   * on `pushState` replaces the entry of the frame, and every change of its
   * URL is sent to TwakeSpace, the initial one too. What TwakeSpace asks
   * goes to `apply`, and the URL it writes is not reported. Returns the
   * function that stops all this.
   */
  syncHistory: (apply: SpaceNavigation) => () => void
  /**
   * The session expired and the silent login cannot show the SSO portal in
   * the frame: TwakeSpace signs the user in again, then reloads its frames
   */
  notifyLoginRequired: () => void
  /**
   * The badges of every team mailbox of the user, for the tabs of TwakeSpace:
   * each report replaces the previous one
   */
  reportBadges: (badges: readonly Badge[]) => void
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
    syncHistory: apply =>
      connection.syncHistory({
        onNavigate: (_id, path) =>
          apply.navigate(path.startsWith('/') ? path : `/${path}`),
        onLoad: (id, path) => {
          const url = embedRoute(TEAM_MAILBOX_EMBED_PREFIX, id) + path
          const target = parseTeamMailboxEmbedPath(url)
          if (target === null) return
          window.history.replaceState(null, '', url)
          apply.load(target)
        }
      }),
    notifyLoginRequired: () => {
      connection.notifyLoginRequired()
    },
    reportBadges: badges => {
      connection.reportBadges(badges)
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
