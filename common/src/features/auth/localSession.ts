import { clearComposerStorage } from '@common/features/composer/composerStorage'

import type { AuthServiceBase, AuthState } from './types'

export const SESSION_CHANNEL_NAME = 'twake-mail-session'
const SESSION_ENDED = 'session-ended'

/**
 * What a tab broadcasts when its session ends: the account it was signed in
 * with, null when it is unknown (an SSO without an `email` claim)
 */
export interface SessionEndedMessage {
  type: typeof SESSION_ENDED
  email: string | null
}

type LocalSession = Pick<AuthServiceBase, 'clearLocalSession' | 'getState'>

/**
 * The composers kept in the browser (`features/composer/composerStorage.ts`)
 * go when the session ends, as tmail-flutter does (ADR 0112)
 */
function forgetComposers(): void {
  void clearComposerStorage()
}

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'function'
    ? new BroadcastChannel(SESSION_CHANNEL_NAME)
    : null
}

function emailOf(state: AuthState): string | null {
  return state.status === 'authenticated' ? state.user.email : null
}

function isSessionEndedMessage(data: unknown): data is SessionEndedMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === SESSION_ENDED &&
    'email' in data &&
    (typeof data.email === 'string' || data.email === null)
  )
}

function isSameAccount(email: string, other: string): boolean {
  return email.trim().toLowerCase() === other.trim().toLowerCase()
}

/**
 * Whether the session that ended elsewhere is the one of this tab. When
 * either account is unknown, it is taken as the same one: signing out one
 * tab too many is safer than keeping one signed in by mistake.
 */
function concernsThisTab(
  message: SessionEndedMessage,
  state: AuthState
): boolean {
  const email = emailOf(state)
  return (
    message.email === null ||
    email === null ||
    isSameAccount(message.email, email)
  )
}

/**
 * Ends the session in this browser: drops the credentials this tab holds in
 * memory and tells the other tabs of the application signed in with the same
 * account to drop theirs. The SSO session itself is ended by the SSO logout
 * endpoint.
 */
export function endLocalSession(session: LocalSession): void {
  const message: SessionEndedMessage = {
    type: SESSION_ENDED,
    email: emailOf(session.getState())
  }
  session.clearLocalSession()
  forgetComposers()
  const channel = openChannel()
  channel?.postMessage(message)
  channel?.close()
}

/**
 * Ends the session of this tab when another tab of the application ends the
 * session of the same account. A tab signed in with another account stays
 * signed in.
 *
 * @returns a function that stops listening
 */
export function onSessionEndedElsewhere(session: LocalSession): () => void {
  const channel = openChannel()
  if (!channel) return () => undefined

  channel.onmessage = (event: MessageEvent): void => {
    if (
      isSessionEndedMessage(event.data) &&
      concernsThisTab(event.data, session.getState())
    ) {
      forgetComposers()
      session.clearLocalSession()
    }
  }
  return () => channel.close()
}
