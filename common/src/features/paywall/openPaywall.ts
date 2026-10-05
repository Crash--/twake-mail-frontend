import { toSafePaywallUrl } from './paywallUrl'

/**
 * Opens the paywall in a new tab (tmail-flutter's `PaywallLauncher`), cut
 * from this page (`noopener`) and from the referrer. The URL is checked
 * again: this is where it is handed to the browser. False when it is not a
 * safe paywall URL, nothing is opened then.
 */
export function openPaywall(url: string): boolean {
  const safeUrl = toSafePaywallUrl(url)
  if (safeUrl === null) {
    console.warn('openPaywall: invalid paywall URL')
    return false
  }
  window.open(safeUrl, '_blank', 'noopener,noreferrer')
  return true
}
