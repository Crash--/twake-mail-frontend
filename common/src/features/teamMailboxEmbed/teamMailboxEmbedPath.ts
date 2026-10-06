/**
 * The facade of a team mailbox, for the Mail tab of a TwakeSpace space (ADR
 * 010 of twake-space-architecture): `/embed/team-mailboxes/<address>`, the
 * address being the resource id the mail side service publishes. The app
 * never receives a space id.
 */
export const TEAM_MAILBOX_EMBED_PREFIX = '/embed/team-mailboxes/'

export interface TeamMailboxEmbedTarget {
  /** The path of the facade, the base of its routes, as written in the URL */
  basename: string
  /** The address of the team mailbox, lowercased */
  address: string
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
  const segment = pathname.slice(TEAM_MAILBOX_EMBED_PREFIX.length).split('/')[0]
  if (segment === undefined || segment === '') return null
  let address: string
  try {
    address = decodeURIComponent(segment).trim().toLowerCase()
  } catch {
    return null
  }
  if (!address.includes('@')) return null
  return { basename: `${TEAM_MAILBOX_EMBED_PREFIX}${segment}`, address }
}
