/**
 * Leaves the application for an external URL (SSO authorization or logout
 * endpoint). In-app navigation goes through react-router instead.
 */
export function redirectTo(url: string): void {
  window.location.assign(url)
}

/**
 * Path, query and fragment of the current page, to come back to it later.
 */
export function getCurrentPath(): string {
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}`
}
