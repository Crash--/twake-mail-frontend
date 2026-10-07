import { useEffect } from 'react'
import { useLocation } from 'react-router'

function isFocusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body || !active.isConnected
}

/**
 * Moves the focus to the main content (the element of id `mainId`, with a
 * `tabIndex` of -1) when a navigation left it nowhere: after signing in (the
 * "Sign In" button went away with the login page), or when the element that
 * was focused went away with the previous view. A view that focuses
 * something of its own (an opened email, a row of the list), or a link that
 * keeps the focus (the folder tree), wins: its effects run first, and the
 * focus is then no longer lost.
 */
export function useFocusMainOnNavigation(mainId: string): void {
  const { pathname } = useLocation()

  useEffect(() => {
    if (isFocusLost()) {
      document.getElementById(mainId)?.focus({ preventScroll: true })
    }
  }, [pathname, mainId])
}
