/**
 * The facade of a team mailbox, for the Mail tab of a TwakeSpace space (ADR
 * 010 of twake-space-architecture): `/embed/team-mailboxes/<id>`, the id of
 * the root folder of the team mailbox, the resource id the mail side service
 * publishes. That id is the same for every member: the `mailboxId` webadmin
 * lists in `/domains/<domain>/team-mailboxes/<name>/mailboxes`. The app
 * never receives a space id.
 */
export const TEAM_MAILBOX_EMBED_PREFIX = '/embed/team-mailboxes/'

/** A JMAP id: 1 to 255 characters of the URL-safe base64 alphabet (RFC 8620, 1.2) */
const JMAP_ID = /^[A-Za-z0-9_-]{1,255}$/

export interface TeamMailboxEmbedTarget {
  /** The path of the facade, the base of its routes */
  basename: string
  /** The id of the root folder of the team mailbox */
  rootId: string
}

/**
 * The team mailbox a path (with its query and fragment, or not) shows, null
 * when it is not a path of the facade
 */
export function parseTeamMailboxEmbedPath(
  path: string
): TeamMailboxEmbedTarget | null {
  const pathname = path.split(/[?#]/)[0] ?? ''
  if (!pathname.startsWith(TEAM_MAILBOX_EMBED_PREFIX)) return null
  const rootId = pathname.slice(TEAM_MAILBOX_EMBED_PREFIX.length).split('/')[0]
  if (rootId === undefined || !JMAP_ID.test(rootId)) return null
  return { basename: `${TEAM_MAILBOX_EMBED_PREFIX}${rootId}`, rootId }
}
