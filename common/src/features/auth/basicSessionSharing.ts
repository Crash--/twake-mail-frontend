export const BASIC_SESSION_CHANNEL_NAME = 'twake-mail-basic-session'
const SESSION_REQUEST = 'basic-session-request'
const SESSION_OFFER = 'basic-session-offer'

/**
 * How long a new tab waits for a signed-in tab to share its session before
 * showing the login form. A tab of the same browser answers in a few
 * milliseconds.
 */
export const SESSION_REQUEST_TIMEOUT_MS = 400

/** The basic credentials a signed-in tab hands to a new tab */
export interface SharedBasicSession {
  email: string
  authorizationHeader: string
}

interface SessionOfferMessage extends SharedBasicSession {
  type: typeof SESSION_OFFER
}

/**
 * Hands the in-memory basic session over between the tabs of the
 * application, so that a reload or "Open in new tab" does not ask to sign in
 * again while another tab is signed in. The credentials go through a
 * same-origin BroadcastChannel only: never through web storage.
 */
export interface BasicSessionSharing {
  /** Asks the other tabs for their session; null when none answers in time */
  request: () => Promise<SharedBasicSession | null>
  /**
   * Answers the requests of the other tabs with the session of this tab,
   * when it has one
   *
   * @returns a function that stops answering
   */
  share: (getSession: () => SharedBasicSession | null) => () => void
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

function isSessionRequest(data: unknown): boolean {
  return isRecord(data) && data.type === SESSION_REQUEST
}

function isSessionOffer(data: unknown): data is SessionOfferMessage {
  return (
    isRecord(data) &&
    data.type === SESSION_OFFER &&
    typeof data.email === 'string' &&
    typeof data.authorizationHeader === 'string' &&
    data.authorizationHeader.startsWith('Basic ')
  )
}

function requestSession(timeoutMs: number): Promise<SharedBasicSession | null> {
  return new Promise(resolve => {
    const channel = new BroadcastChannel(BASIC_SESSION_CHANNEL_NAME)
    const finish = (session: SharedBasicSession | null): void => {
      clearTimeout(timeout)
      channel.close()
      resolve(session)
    }
    const timeout = setTimeout(() => finish(null), timeoutMs)

    channel.onmessage = (event: MessageEvent): void => {
      if (isSessionOffer(event.data)) {
        finish({
          email: event.data.email,
          authorizationHeader: event.data.authorizationHeader
        })
      }
    }
    channel.postMessage({ type: SESSION_REQUEST })
  })
}

function shareSession(getSession: () => SharedBasicSession | null): () => void {
  const channel = new BroadcastChannel(BASIC_SESSION_CHANNEL_NAME)

  channel.onmessage = (event: MessageEvent): void => {
    const session = getSession()
    if (!isSessionRequest(event.data) || session === null) return

    const offer: SessionOfferMessage = { type: SESSION_OFFER, ...session }
    channel.postMessage(offer)
  }
  return () => channel.close()
}

/**
 * The session sharing of the browser, null without BroadcastChannel
 */
export function makeBasicSessionSharing(
  timeoutMs: number = SESSION_REQUEST_TIMEOUT_MS
): BasicSessionSharing | null {
  if (typeof BroadcastChannel !== 'function') return null
  return {
    request: () => requestSession(timeoutMs),
    share: shareSession
  }
}
