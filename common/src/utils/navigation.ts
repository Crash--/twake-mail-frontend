/**
 * Leaves the application for an external URL (SSO logout endpoint). In-app
 * navigation goes through react-router instead.
 */
export function redirectTo(url: string): void {
  window.location.assign(url)
}
