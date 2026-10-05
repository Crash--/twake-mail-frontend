/** The relation of the WebFinger link to the OpenID Connect issuer */
export const ISSUER_REL = 'http://openid.net/specs/connect/1.0/issuer'

const WEBFINGER_PATH = '/.well-known/webfinger'
const OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration'

/** Each request of the discovery, in milliseconds */
const REQUEST_TIMEOUT_MS = 5000

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
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

async function fetchJson(
  url: string,
  fetchFn: typeof fetch,
  accept: string
): Promise<unknown> {
  try {
    // A public document: never the credentials of the user
    const response = await fetchFn(url, {
      credentials: 'omit',
      headers: { Accept: accept },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    return response.ok ? ((await response.json()) as unknown) : null
  } catch {
    return null
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
 * that one). Null when the server has none or does not answer in time.
 */
export async function findIssuerByWebFinger(
  serverUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<string | null> {
  const server = toHttpUrl(serverUrl)
  if (server === null) return null
  const url = new URL(`${removeTrailingSlashes(serverUrl)}${WEBFINGER_PATH}`)
  url.searchParams.set('resource', server.origin)
  url.searchParams.set('rel', ISSUER_REL)

  const document = await fetchJson(
    url.href,
    fetchFn,
    'application/jrd+json, application/json'
  )
  const links = readLinks(document)
  const link =
    links.find(candidate => readString(candidate, 'rel') === ISSUER_REL) ??
    links[0]
  const issuer = toHttpUrl(readString(link, 'href'))
  return issuer === null ? null : removeTrailingSlashes(issuer.href)
}

/**
 * Whether a URL is the issuer of an OpenID Connect provider: its
 * `/.well-known/openid-configuration` answers with a document.
 */
export async function isOpenIdIssuer(
  issuerUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const document = await fetchJson(
    `${removeTrailingSlashes(issuerUrl)}${OPENID_CONFIGURATION_PATH}`,
    fetchFn,
    'application/json'
  )
  return typeof readString(document, 'issuer') === 'string'
}
