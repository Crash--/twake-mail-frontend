// Upstream to twake-ui: yes. The top bar of a full-screen form on a phone
// (Teammail 1.1 mobile composer, tmail-flutter `MobileAppBarComposerWidget`):
// the way out at the start, the actions at the end, 56 px high.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

/** Height of the bar, in px (tmail-flutter `MobileAppBarComposerWidgetStyle`) */
export const TOP_ACTION_BAR_HEIGHT = 56

export interface TopActionBarProps {
  /** Before the actions, at the start: the close button */
  start: ReactNode
  /** The actions, at the end, next to each other */
  children: ReactNode
  'data-testid'?: string
}

/**
 * A 56 px bar on the page background: `start`, space, then the actions
 * (44 px touch targets, side by side). Its content is the caller's.
 */
export function TopActionBar({
  start,
  children,
  'data-testid': testId
}: TopActionBarProps): ReactElement {
  return (
    <Box
      data-testid={testId}
      className="u-flex u-flex-items-center u-flex-shrink-0"
      sx={{
        minHeight: TOP_ACTION_BAR_HEIGHT,
        px: 0.5,
        gap: 0,
        // The light grey of tmail-flutter's composer bar on phones, its
        // steel grey icons
        bgcolor: '#F4F4F4',
        color: '#55687D',
        '& .MuiIconButton-root:not([aria-pressed="true"])': {
          color: 'inherit'
        },
        borderBottom: '1px solid #F4F4F4'
      }}
    >
      {start}
      <Box className="u-flex-auto" />
      {children}
    </Box>
  )
}
