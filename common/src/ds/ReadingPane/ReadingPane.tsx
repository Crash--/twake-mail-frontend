// Upstream to twake-ui: no, a column at least as tall as the area it is in.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const PANE_SX = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100%',
  // A flex item of the pane would shrink to its height, and the sticky bars with it
  flexShrink: 0
} as const

export interface ReadingPaneProps {
  children: ReactNode
  'data-testid'?: string
}

/**
 * The column of an open email or conversation: at least as tall as the
 * scrolling area, so that the bar of answers sits at the bottom of a short
 * message, and stays there over a long one (`ActionBar`).
 */
export function ReadingPane({
  children,
  'data-testid': testId
}: ReadingPaneProps): ReactElement {
  return (
    <Box sx={PANE_SX} data-testid={testId}>
      {children}
    </Box>
  )
}
