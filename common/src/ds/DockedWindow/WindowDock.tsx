// Upstream to twake-ui: yes, with DockedWindow.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { OverlayPortal } from '@linagora/twake-mui'

/** Space between the windows and from the edge of the screen, in px */
export const DOCK_GAP = 8
export const DOCK_MARGIN = 24
/** Width of the overflow menu at the start of the dock, in px */
export const OVERFLOW_MENU_WIDTH = 160

export interface WindowDockProps {
  /** The windows, the newest first: it sits at the end of the line */
  children: ReactNode
  /**
   * At the start of the line, before the oldest window: the
   * `WindowOverflowMenu` of the windows left out. First in the focus order
   */
  start?: ReactNode
  'data-testid'?: string
}

/**
 * The line of `DockedWindow`s at the bottom end of the screen, the newest
 * at the end. It only takes the clicks its windows take: the page under
 * its empty part stays usable. Framed by TwakeSpace, it sits at the bottom
 * end of the page of TwakeSpace, not of the frame.
 */
export function WindowDock({
  children,
  start,
  'data-testid': testId
}: WindowDockProps): ReactElement {
  return (
    <OverlayPortal>
      <Box
        className="u-flex u-flex-items-end"
        sx={{
          position: 'fixed',
          right: `calc(${DOCK_MARGIN}px + env(safe-area-inset-right))`,
          bottom: DOCK_MARGIN,
          left: DOCK_MARGIN,
          flexDirection: 'row-reverse',
          gap: `${DOCK_GAP}px`,
          pointerEvents: 'none',
          zIndex: theme => theme.zIndex.drawer + 1
        }}
        data-testid={testId}
      >
        {start ? (
          // Last of the reversed line: the far left
          <Box className="u-flex u-flex-items-end" sx={{ order: 1 }}>
            {start}
          </Box>
        ) : null}
        {children}
      </Box>
    </OverlayPortal>
  )
}
