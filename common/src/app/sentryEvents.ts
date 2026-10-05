import type {
  Breadcrumb,
  ErrorEvent,
  EventHint,
  Exception
} from '@sentry/react'

import {
  scrubDeep,
  scrubText,
  scrubUrl
} from '@common/utils/scrubSensitiveData'

/** The longest message or exception value that leaves the browser */
const MAX_TEXT_LENGTH = 300

/**
 * The breadcrumbs kept: the requests (method, status and URL without query
 * nor identifiers) and the navigation. Console breadcrumbs carry the
 * arguments of the call sites, and the interaction ones (clicks, input) the
 * accessible names of the elements, which for a message row hold its sender
 * and subject: both are dropped.
 */
const KEPT_BREADCRUMB_CATEGORIES = new Set([
  'fetch',
  'xhr',
  'navigation',
  'history'
])

const KEPT_BREADCRUMB_DATA = new Set([
  'url',
  'method',
  'status_code',
  'from',
  'to'
])

const NETWORK_ERROR_REGEX =
  /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error/i

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH
    ? `${text.slice(0, MAX_TEXT_LENGTH)}…`
    : text
}

function scrubMessage(text: string): string {
  return truncate(scrubText(text))
}

/**
 * The text of an exception. The ones of the JMAP client end with the
 * description the server gave (`Email/get (c0) failed with invalidArguments:
 * <description>`), which may quote the subject of a message, a name of
 * folder or an address: only what comes before is kept.
 */
function scrubExceptionValue(type: string | undefined, value: string): string {
  const text = type?.startsWith('Jmap') ? (value.split(': ')[0] ?? '') : value
  return scrubMessage(text)
}

function getStatus(error: object): number | null {
  return 'status' in error && typeof error.status === 'number'
    ? error.status
    : null
}

/**
 * An error that is expected in the life of a webmail and tells nothing the
 * developers can act on, as tmail-flutter keeps them out of Sentry: the
 * network that fails or is aborted, and the HTTP errors of the server (the
 * 401, which `onUnauthorized` already handled, and the other 4xx and 5xx).
 */
export function isExpectedError(candidate: unknown): boolean {
  if (typeof candidate !== 'object' || candidate === null) return false
  const name = 'name' in candidate ? candidate.name : null
  if (name === 'AbortError') return true
  const message =
    'message' in candidate && typeof candidate.message === 'string'
      ? candidate.message
      : ''
  if (name === 'TypeError' && NETWORK_ERROR_REGEX.test(message)) return true
  // JmapHttpError and JmapRequestError carry the HTTP status of the answer
  const status = getStatus(candidate)
  return (
    typeof name === 'string' &&
    name.startsWith('Jmap') &&
    status !== null &&
    status >= 400
  )
}

/**
 * The errors behind an event: the one captured, and the arguments of a
 * `console.error(…)` call, where the console integration keeps them.
 */
function getCandidates(
  event: ErrorEvent,
  hint: EventHint | undefined
): unknown[] {
  const logged: unknown = event.extra?.arguments
  // SAFETY: the console integration stores the arguments of the call in an array
  const logs = Array.isArray(logged) ? (logged as unknown[]) : []
  return [hint?.originalException, ...logs]
}

function isExpectedEvent(
  event: ErrorEvent,
  hint: EventHint | undefined
): boolean {
  if (getCandidates(event, hint).some(isExpectedError)) return true
  return (event.exception?.values ?? []).some(
    (exception: Exception) =>
      exception.type === 'AbortError' ||
      (exception.type === 'TypeError' &&
        NETWORK_ERROR_REGEX.test(exception.value ?? ''))
  )
}

/**
 * Keeps a breadcrumb only when it is a request or a navigation, reduced to
 * its method, status and scrubbed URLs; null drops it.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (!KEPT_BREADCRUMB_CATEGORIES.has(breadcrumb.category ?? '')) return null
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(breadcrumb.data ?? {})) {
    if (KEPT_BREADCRUMB_DATA.has(key)) data[key] = value
  }
  return {
    type: breadcrumb.type,
    category: breadcrumb.category,
    level: breadcrumb.level,
    timestamp: breadcrumb.timestamp,
    data: scrubDeep(data)
  }
}

function scrubException(exception: Exception): Exception {
  const { type, value, mechanism, stacktrace } = exception
  return {
    type,
    ...(value === undefined ? {} : { value: scrubExceptionValue(type, value) }),
    ...(mechanism
      ? { mechanism: { type: mechanism.type, handled: mechanism.handled } }
      : {}),
    ...(stacktrace
      ? {
          stacktrace: {
            frames: stacktrace.frames?.map(frame => ({
              filename: frame.filename ? scrubUrl(frame.filename) : undefined,
              function: frame.function,
              lineno: frame.lineno,
              colno: frame.colno,
              in_app: frame.in_app
            }))
          }
        }
      : {})
  }
}

/**
 * The event as it leaves the browser: only the release, the environment, the
 * message or exceptions (scrubbed, truncated, without the source lines nor
 * local variables), the user identifier, the URL without query nor
 * identifiers, and the scrubbed breadcrumbs. Everything else the SDK or a call
 * site attached goes through the key based scrubbing. Null drops the event
 * (an expected error).
 */
export function scrubEvent(
  event: ErrorEvent,
  hint?: EventHint
): ErrorEvent | null {
  if (isExpectedEvent(event, hint)) return null

  const scrubbed = scrubDeep({
    ...event,
    // The arguments of a console call: JMAP objects with subjects,
    // addresses and bodies. Only its message is kept
    extra: Object.fromEntries(
      Object.entries(event.extra ?? {}).filter(([key]) => key !== 'arguments')
    ),
    // Nothing of the HTTP exchanges but the URL and the method: the headers
    // hold the Referer and cookies, the body the mails
    request: event.request
      ? { url: event.request.url, method: event.request.method }
      : undefined,
    user: event.user?.id === undefined ? undefined : { id: event.user.id }
  })
  const exceptions = event.exception?.values
  return {
    ...scrubbed,
    ...(event.message === undefined
      ? {}
      : { message: scrubMessage(event.message) }),
    ...(exceptions
      ? { exception: { values: exceptions.map(scrubException) } }
      : {}),
    ...(event.transaction === undefined
      ? {}
      : { transaction: scrubUrl(event.transaction) }),
    breadcrumbs: (event.breadcrumbs ?? [])
      .map(scrubBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null)
  }
}
