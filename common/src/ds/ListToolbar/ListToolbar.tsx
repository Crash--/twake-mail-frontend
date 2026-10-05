// Upstream to twake-ui: no, a layout detail of the Twake Mail design: the
// toolbar above the list has 16 px of padding above and below, 16 px between
// its controls, and a divider below at half its opacity.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

export interface ListToolbarProps {
  /** Accessible name of the toolbar region */
  label: string
  children: ReactNode
  'data-testid'?: string
}

/** The row of controls above a list: refresh, select all, filters. */
export function ListToolbar({
  label,
  children,
  'data-testid': testId
}: ListToolbarProps): ReactElement {
  return (
    <Box
      component="section"
      aria-label={label}
      className="u-flex u-flex-items-center u-flex-wrap"
      sx={theme => ({
        gap: 2,
        py: 2,
        borderBottom: 1,
        borderColor: `color-mix(in srgb, ${theme.palette.divider} 50%, transparent)`,
        // Phones: the list around has no padding
        [`@media ${SCREEN_QUERIES.mobile}`]: { px: 2 }
      })}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
