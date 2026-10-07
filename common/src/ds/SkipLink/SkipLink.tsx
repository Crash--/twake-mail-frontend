// Upstream to twake-ui: yes. Every Twake app needs a skip link (RGAA 12.7,
// WCAG 2.4.1) and twake-mui has none: a `Link` hidden until it takes the
// focus, that moves the focus itself instead of changing the URL hash (a
// hash would be a navigation for the router).
import { Link } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

import { VISUALLY_HIDDEN } from '@/ds/MessageAlert/visuallyHidden'

const SKIP_LINK_SX = {
  ...VISUALLY_HIDDEN,
  '&:focus': {
    clip: 'auto',
    height: 'auto',
    width: 'auto',
    margin: 0,
    overflow: 'visible',
    position: 'fixed',
    top: 8,
    left: 8,
    zIndex: 'tooltip',
    px: 2,
    py: 1,
    bgcolor: 'background.paper',
    borderRadius: 1,
    boxShadow: 2
  }
} as const

export interface SkipLinkProps {
  /** What the link says, e.g. "Skip to main content" */
  label: string
  /** The `id` of the element to focus: it needs a `tabIndex` of -1 */
  targetId: string
  'data-testid'?: string
}

/**
 * The first stop of the page: a link to its main content, invisible until
 * the keyboard reaches it. Following it focuses the target, so the next Tab
 * goes on from there.
 */
export function SkipLink({
  label,
  targetId,
  'data-testid': testId
}: SkipLinkProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault()
    document.getElementById(targetId)?.focus()
  }

  return (
    <Link
      href={`#${targetId}`}
      onClick={handleClick}
      sx={SKIP_LINK_SX}
      data-testid={testId}
    >
      {label}
    </Link>
  )
}
