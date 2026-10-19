/** The relation of the WebFinger link to the OpenID Connect issuer */
export const ISSUER_REL = 'http://openid.net/specs/connect/1.0/issuer'

const WEBFINGER_PATH = '/.well-known/webfinger'
const OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration'

/** Each request of the discovery, in milliseconds */
const REQUEST_TIMEOUT_MS = 5000

function removeTrailingSlashes(value: string): string {
  // (?<!…): a run is tried from its first character only (ReDoS)
  return value.replace(/(?<!\/)\/+$/, '')
}

function toHttpUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/**
 * `absent`: the server answered and has none (a 404 or a 410, a JSON
 * document without it, or a 2xx body that is neither JSON nor HTML).
 * `unavailable`: it may have one but did not answer (any other error
 * status, such as a 401 or 403 in front of the SSO, an HTML page or a page
 * reached through a redirection that is not JSON, a timeout, a network
 * error). A JSON document is read the same with or without a redirection.
 */
export type DiscoveryResult<T> =
  { ok: true; value: T } | { ok: false; error: 'absent' | 'unavailable' }

const ABSENT_STATUSES: readonly number[] = [404, 410]

const ABSENT = { ok: false, error: 'absent' } as const
const UNAVAILABLE = { ok: false, error: 'unavailable' } as const

async function fetchJson(
  url: string,
  fetchFn: typeof fetch,
  accept: string,
  /** What a fetch failing with a `TypeError` tells */
  networkError: typeof ABSENT | typeof UNAVAILABLE = UNAVAILABLE
): Promise<DiscoveryResult<unknown>> {
  let response: Response
  try {
    // A public document: never the credentials of the user
    response = await fetchFn(url, {
      credentials: 'omit',
      headers: { Accept: accept },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error: unknown) {
    // A network error, or an answer blocked for want of CORS headers: fetch
    // cannot tell them apart
    return error instanceof TypeError ? networkError : UNAVAILABLE
  }
  if (!response.ok) {
    return ABSENT_STATUSES.includes(response.status) ? ABSENT : UNAVAILABLE
  }
  try {
    return { ok: true, value: (await response.json()) as unknown }
  } catch (error: unknown) {
    // The timeout or the connection cut mid-body is no answer
    const isNotJson =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'SyntaxError'
    if (!isNotJson) return UNAVAILABLE
    // Not JSON is an answer, unless it is the login page an authentication
    // proxy redirected to. A JSON document after a redirection (RFC 7033
    // §4.2: http to https, another host) is read as any other
    const isHtml = (response.headers.get('content-type') ?? '').includes(
      'text/html'
    )
    return response.redirected || isHtml ? UNAVAILABLE : ABSENT
  }
}

function readLinks(document: unknown): unknown[] {
  if (typeof document !== 'object' || document === null) return []
  const links: unknown = Object.getOwnPropertyDescriptor(
    document,
    'links'
  )?.value
  return Array.isArray(links) ? (links as unknown[]) : []
}

function readString(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? Object.getOwnPropertyDescriptor(value, key)?.value
    : undefined
}

/**
 * The issuer of the SSO of a JMAP server, as tmail-flutter asks for it: the
 * WebFinger of the origin of the server, `GET
 * <serverUrl>/.well-known/webfinger?resource=<origin>&rel=<issuer relation>`.
 * The link of the issuer relation, else the first one (tmail-flutter takes
 * that one).
 */
export async function findIssuerByWebFinger(
  serverUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<DiscoveryResult<string>> {
  const server = toHttpUrl(serverUrl)
  if (server === null) return ABSENT
  const url = new URL(`${removeTrailingSlashes(serverUrl)}${WEBFINGER_PATH}`)
  url.searchParams.set('resource', server.origin)
  url.searchParams.set('rel', ISSUER_REL)

  const document = await fetchJson(
    url.href,
    fetchFn,
    'application/jrd+json, application/json'
  )
  if (!document.ok) return document
  const links = readLinks(document.value)
  const link =
    links.find(candidate => readString(candidate, 'rel') === ISSUER_REL) ??
    links[0]
  const issuer = toHttpUrl(readString(link, 'href'))
  return issuer === null
    ? ABSENT
    : { ok: true, value: removeTrailingSlashes(issuer.href) }
}

/**
 * Whether a URL is the issuer of an OpenID Connect provider: its
 * `/.well-known/openid-configuration` answers with a document. A JMAP
 * server without SSO seldom answers CORS there: an answer the browser
 * blocks counts as none, not as an outage (WebFinger tells those).
 */
export async function isOpenIdIssuer(
  issuerUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<DiscoveryResult<true>> {
  const document = await fetchJson(
    `${removeTrailingSlashes(issuerUrl)}${OPENID_CONFIGURATION_PATH}`,
    fetchFn,
    'application/json',
    ABSENT
  )
  if (!document.ok) return document
  return typeof readString(document.value, 'issuer') === 'string'
    ? { ok: true, value: true }
    : ABSENT
}
