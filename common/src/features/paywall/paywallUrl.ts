import { resolveUrlTemplate, usesPlaceholder } from './urlTemplate'

/**
 * The URLs of the storage upgrade (the paywall), as tmail-flutter's
 * `PaywallUtils` and `PaywallUrlPattern`: only an absolute `https` URL
 * without credentials, on a host that looks like a FQDN, is ever opened.
 */

const PAYWALL_PATH = '/settings/premium'

/** An explicit http(s) scheme */
const HTTP_SCHEME_PATTERN = /^https?:\/\//i

/** `https://` followed by a host, not by more slashes */
const EXPLICIT_HOST_PATTERN = /^https:\/\/[^/\\]/i

/** Any scheme: `https:`, but also the `host` of `host:8443` */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i

/** A FQDN looks valid with at least two non-empty labels (tmail-flutter) */
export function isValidFqdn(fqdn: string): boolean {
  if (fqdn.trim() === '' || !fqdn.includes('.')) return false
  return fqdn.split('.').filter(part => part.trim() !== '').length >= 2
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isSecureAbsoluteUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.hostname !== ''
  )
}

/**
 * Trims and checks a Workplace FQDN as tmail-flutter's
 * `normalizeWorkplaceFqdn`: a bare host (no path, query nor fragment) in
 * https, with an explicit `https://` or without scheme. Null when unusable.
 */
export function normalizeWorkplaceFqdn(
  rawFqdn: string | null | undefined
): string | null {
  const fqdn = rawFqdn?.trim()
  if (fqdn === undefined || fqdn === '') return null
  const url = parseUrl(
    HTTP_SCHEME_PATTERN.test(fqdn) ? fqdn : `https://${fqdn}`
  )
  if (url === null || url.hostname === '') return null
  const isBare =
    (url.pathname === '' || url.pathname === '/') &&
    url.search === '' &&
    url.hash === ''
  if (!isBare || url.protocol !== 'https:') return null
  return fqdn.endsWith('/') ? fqdn.slice(0, -1) : fqdn
}

/**
 * The paywall of the Workplace: `/settings/premium` on its FQDN. An empty
 * string when the FQDN is missing, not https, carries credentials or is not a
 * valid FQDN.
 */
export function buildWorkplacePaywallUrl(
  workplaceFqdn: string | null | undefined
): string {
  const fqdn = workplaceFqdn?.trim()
  if (fqdn === undefined || fqdn === '') return ''
  // As Dart's Uri.tryParse: a value with a scheme keeps it (so a `host:port`
  // is read as a scheme, and refused)
  const url = parseUrl(SCHEME_PATTERN.test(fqdn) ? fqdn : `https://${fqdn}`)
  if (url === null || !isSecureAbsoluteUrl(url)) return ''
  if (!isValidFqdn(url.hostname)) return ''
  const port = url.port === '' ? '' : `:${url.port}`
  return `https://${url.hostname}${port}${PAYWALL_PATH}`
}

/**
 * Whether a URL may be opened as the paywall: absolute, `https`, no
 * credentials, on a valid FQDN
 */
export function isValidPaywallUrl(url: string | null | undefined): boolean {
  const normalized = url?.trim()
  if (normalized === undefined || normalized === '') return false
  // `https:///host` is read by browsers as `https://host`: no host is written
  if (!EXPLICIT_HOST_PATTERN.test(normalized)) return false
  const parsed = parseUrl(normalized)
  if (parsed === null || !isSecureAbsoluteUrl(parsed)) return false
  return isValidFqdn(parsed.hostname)
}

/**
 * The URL to open, as the browser reads it (so what was validated is what is
 * opened); null when it is not a valid paywall URL
 */
export function toSafePaywallUrl(
  url: string | null | undefined
): string | null {
  const normalized = url?.trim()
  if (!isValidPaywallUrl(normalized)) return null
  return parseUrl(normalized ?? '')?.href ?? null
}

/**
 * A paywall URL built from a template. Supports `{localPart}`,
 * `{domainName}` and `{domainPart}` (an alias of `domainName`), raw or
 * URL-encoded; a missing value is removed. Null when the template is
 * malformed.
 */
export function buildPaywallUrlFromTemplate({
  template,
  localPart,
  domainName
}: {
  template: string
  localPart?: string | null
  domainName?: string | null
}): string | null {
  return resolveUrlTemplate(template, {
    localPart: localPart ?? '',
    domainName: domainName ?? '',
    domainPart: domainName ?? ''
  })
}

/** What may be written into a URL: no `/ ? # @ : %`, no space */
const SAFE_LOCAL_PART = /^[A-Za-z0-9_+-]+$/
const SAFE_DOMAIN = /^[A-Za-z0-9.-]+$/
const ADDRESS_PATTERN = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/

/**
 * The template filled for the owner of the mailbox
 * (`PaywallUrlPattern.resolveQualifiedUrl`): `{localPart}` is the local part
 * of the address without its dots, `{domainName}` (`{domainPart}`) the given
 * domain, else the one of the address. Null when a placeholder cannot be
 * filled: a half-filled URL points at the wrong host. These are the only
 * data of the user in the URL, and only characters of a host or a path
 * segment go through (tmail-flutter writes any).
 */
export function resolveQualifiedUrl(
  template: string,
  { ownerEmail, domainName }: { ownerEmail: string; domainName?: string | null }
): string | null {
  const hasDomain = domainName !== undefined && domainName !== null
  const needsAddress =
    usesPlaceholder(template, 'localPart') ||
    (!hasDomain &&
      (usesPlaceholder(template, 'domainName') ||
        usesPlaceholder(template, 'domainPart')))
  const match = needsAddress ? ADDRESS_PATTERN.exec(ownerEmail.trim()) : null
  const localPart = match?.[1]?.replaceAll('.', '') ?? null
  const domain = hasDomain ? domainName : (match?.[2] ?? null)
  const isDomainSafe =
    domain !== null && domain !== '' && SAFE_DOMAIN.test(domain)
  return resolveUrlTemplate(template, {
    localPart:
      localPart !== null && SAFE_LOCAL_PART.test(localPart) ? localPart : null,
    domainName: isDomainSafe ? domain : null,
    domainPart: isDomainSafe ? domain : null
  })
}

/**
 * The domain tmail-flutter fills `{domainName}` with: the last two labels of
 * the host the app runs on (`RouteUtils.getRootDomain`)
 */
export function getRootDomain(hostname: string): string | null {
  if (hostname === '') return null
  const parts = hostname.split('.')
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname
}
