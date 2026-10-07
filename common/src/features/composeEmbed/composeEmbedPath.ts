/**
 * The facade of the composer, for an app that frames Twake Mail to write an
 * email without leaving it (Twake Chat, « Send an e-mail » on a profile):
 * `/embed/compose?uri=mailto:…` opens a composer with what the link gives,
 * the way `/mailto` does, and shows nothing else. As in TwakeSpace, the
 * composer renders onto the overlay the framing page puts over its window.
 */
export const COMPOSE_EMBED_PATH = '/embed/compose'

/** Whether a path (with its query and fragment, or not) is the facade's */
export function isComposeEmbedPath(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] ?? ''
  return (
    pathname === COMPOSE_EMBED_PATH || pathname === `${COMPOSE_EMBED_PATH}/`
  )
}
