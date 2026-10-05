import { useEffect, useRef, type ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useComposer } from './ComposerProvider'
import { mailtoFromSearch } from './mailto'

/**
 * The `/mailto?uri=mailto:…` route (tmail-flutter ADR 0036): opens a
 * composer with what the link gives, then shows the mailbox. The composer
 * waits for the identities and the folders itself: the link can be opened
 * before the mailbox is ready, and after a sign-in (the route is kept as
 * the return path).
 */
export function MailtoRoute(): ReactElement {
  const { search } = useLocation()
  const { openComposer } = useComposer()
  const openedRef = useRef(false)

  useEffect(() => {
    // Once, the effect running twice in development
    if (openedRef.current) return
    openedRef.current = true
    const mailto = mailtoFromSearch(search)
    if (mailto !== null) openComposer({ mailto })
  }, [search, openComposer])

  return <Navigate to="/" replace />
}
