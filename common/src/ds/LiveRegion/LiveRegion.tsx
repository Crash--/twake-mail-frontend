// Upstream to twake-ui: yes. Every Twake app needs a polite live region that
// is always mounted and invisible; twake-css only has the `u-visuallyhidden`
// class, which is absolute and, placed at the end of the page, a pixel under
// the viewport, makes the document scroll.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface LiveRegionProps {
  /** What to say; nothing (empty) when there is nothing to say */
  children?: ReactNode
  'data-testid'?: string
}

/**
 * A polite live region (`role="status"`), visually hidden and fixed at the
 * top of the screen so that it never takes room nor scrolls the page. Mount
 * it once, always: a live region only announces what changes in it, so the
 * text goes in and out of an element that stays.
 */
export function LiveRegion({
  children,
  'data-testid': testId
}: LiveRegionProps): ReactElement {
  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0 }}>
      <Box role="status" className="u-visuallyhidden" data-testid={testId}>
        {children}
      </Box>
    </Box>
  )
}
