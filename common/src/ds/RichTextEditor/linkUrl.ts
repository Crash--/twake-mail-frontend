import { isAllowedUri } from '@tiptap/extension-link'

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

const SCHEME = /^[a-z][a-z\d+.-]*:/i

/** `example.org`, `www.example.org:8080/path?q#top`: a host without scheme */
const BARE_HOST = /^[a-z\d-]+(\.[a-z\d-]+)+(:\d+)?([/?#]\S*)?$/i

function parseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function isSupportedAbsoluteUrl(url: string): boolean {
  const parsed = parseUrl(url)
  if (parsed === null || !SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    return false
  }
  const isWeb = parsed.protocol === 'http:' || parsed.protocol === 'https:'
  return (!isWeb || parsed.hostname !== '') && Boolean(isAllowedUri(url))
}

/**
 * The address a link dialog can insert: an absolute web address, `mailto:`
 * or `tel:`, a bare host completed with `https://`; `null` for anything
 * else (`javascript:`, a relative address, plain text), which a link would
 * leave dead or unsafe
 */
export function toLinkUrl(raw: string): string | null {
  const url = raw.trim()
  if (BARE_HOST.test(url)) {
    // A host whose last label is a number parses as IPv4 (`e.0` does not)
    const completed = `https://${url}`
    return isSupportedAbsoluteUrl(completed) ? completed : null
  }
  if (!SCHEME.test(url)) return null
  return isSupportedAbsoluteUrl(url) ? url : null
}
