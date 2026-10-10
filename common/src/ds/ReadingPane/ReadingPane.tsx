// Upstream to twake-ui: no, a column at least as tall as the area it is in.
import { Box } from '@linagora/twake-mui'
import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

/**
 * True in a frame whose scroll bars must stay 16 px inside its edges: the
 * reading view scrolls its content between its bars, which keep the whole
 * width, and the content drops its own side padding
 */
export const ReadingInsetContext = createContext(false)

export function useIsReadingInset(): boolean {
  return useContext(ReadingInsetContext)
}

const PANE_SX = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100%',
  // A flex item of the pane would shrink to its height, and the sticky bars with it
  flexShrink: 0
} as const

const INSET_PANE_SX = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0
} as const

const INSET_SCROLL_SX = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  mx: '16px'
} as const

export interface ReadingPaneProps {
  /** The bar at the top, e.g. the way back */
  toolbar: ReactNode
  /** The bar of answers at the bottom, if any */
  replyBar?: ReactNode
  children: ReactNode
  'data-testid'?: string
}

/**
 * The column of an open email or conversation: at least as tall as the
 * scrolling area, so that the bar of answers sits at the bottom of a short
 * message, and stays there over a long one (`ActionBar`).
 */
export function ReadingPane({
  toolbar,
  replyBar = null,
  children,
  'data-testid': testId
}: ReadingPaneProps): ReactElement {
  if (useIsReadingInset()) {
    return (
      <Box sx={INSET_PANE_SX} data-testid={testId}>
        {toolbar}
        <Box sx={INSET_SCROLL_SX}>{children}</Box>
        {replyBar}
      </Box>
    )
  }
  return (
    <Box sx={PANE_SX} data-testid={testId}>
      {toolbar}
      {children}
      {replyBar}
    </Box>
  )
}
