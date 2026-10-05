import type { AuthServiceBase } from './types'

export const SESSION_CHANNEL_NAME = 'twake-mail-session'
const SESSION_ENDED = 'session-ended'

/**
 * Composers kept for a reload (`features/composer/composerContent.ts`):
 * signing out drops them, as tmail-flutter does (ADR 0112)
 */
const COMPOSER_KEYS_PREFIX = 'twake-mail-composer'

function forgetComposers(): void {
  // Not in every runtime (Node tests)
  if (typeof sessionStorage === 'undefined') return
  const keys: string[] = []
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith(COMPOSER_KEYS_PREFIX)) keys.push(key)
  }
  keys.forEach(key => {
    sessionStorage.removeItem(key)
  })
}

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'function'
    ? new BroadcastChannel(SESSION_CHANNEL_NAME)
    : null
}

/**
 * Ends the session in this browser: drops the credentials this tab holds in
 * memory and tells the other tabs of the application to drop theirs. The SSO
 * session itself is ended by the SSO logout endpoint.
 */
export function endLocalSession(
  session: Pick<AuthServiceBase, 'clearLocalSession'>
): void {
  session.clearLocalSession()
  forgetComposers()
  const channel = openChannel()
  channel?.postMessage(SESSION_ENDED)
  channel?.close()
}

/**
 * Calls `onEnded` when another tab of the application ends the session.
 *
 * @returns a function that stops listening
 */
export function onSessionEndedElsewhere(onEnded: () => void): () => void {
  const channel = openChannel()
  if (!channel) return () => undefined

  channel.onmessage = (event: MessageEvent): void => {
    if (event.data === SESSION_ENDED) {
      forgetComposers()
      onEnded()
    }
  }
  return () => channel.close()
}
