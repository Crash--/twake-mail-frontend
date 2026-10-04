const AUTH_PATHS = ['/callback', '/login']

/**
 * The in-app path to go back to after signing in, or `/` when the value is
 * not a path of this application: a full URL or a protocol-relative one
 * would turn the login flow into an open redirect.
 */
export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.includes('\\')) return '/'
  const pathname = value.split(/[?#]/)[0] ?? ''
  if (AUTH_PATHS.includes(pathname)) return '/'
  return value
}
