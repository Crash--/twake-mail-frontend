import type { FetchFunction } from 'jmap-client-ts'

/**
 * How long a JMAP API call (or the session fetch) may take, body included,
 * before it fails (ms). Above the slowest legitimate call (large `Email/get`
 * chunks, searches over big mailboxes), so that only a request lost by a
 * proxy or a stalled backend reaches it.
 */
export const JMAP_REQUEST_TIMEOUT_MS = 30_000

function makeTimeoutError(): DOMException {
  return new DOMException('The request timed out', 'TimeoutError')
}

/**
 * A signal aborted when `signal` is, or with a `TimeoutError` after
 * `timeoutMs`. `AbortSignal.any` would do it, but Safari only has it from
 * 17.4.
 */
export function withDeadline(
  signal: AbortSignal | null | undefined,
  timeoutMs: number
): AbortSignal {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(makeTimeoutError())
  }, timeoutMs)
  const forward = (): void => {
    clearTimeout(timer)
    controller.abort(signal?.reason)
  }
  if (signal?.aborted) forward()
  else signal?.addEventListener('abort', forward, { once: true })
  return controller.signal
}

/**
 * Whether the request is a JSON exchange (API call, session, push ticket):
 * uploads send a binary body and downloads stream a blob, for as long as
 * their size needs, so they get no deadline.
 */
function isJsonExchange(init: RequestInit | undefined): boolean {
  const body = init?.body
  const isJsonBody =
    body === undefined || body === null || typeof body === 'string'
  return (
    isJsonBody &&
    new Headers(init?.headers).get('Accept') === 'application/json'
  )
}

/**
 * Wraps the `fetch` of the JMAP client so that its JSON exchanges fail with a
 * `TimeoutError` after `timeoutMs` instead of hanging forever: the query then
 * fails, is retried, and shows its error with Retry.
 */
export function withRequestDeadline(
  fetchFunction: FetchFunction,
  timeoutMs: number = JMAP_REQUEST_TIMEOUT_MS
): FetchFunction {
  return (input, init) =>
    isJsonExchange(init)
      ? fetchFunction(input, {
          ...init,
          signal: withDeadline(init?.signal, timeoutMs)
        })
      : fetchFunction(input, init)
}
