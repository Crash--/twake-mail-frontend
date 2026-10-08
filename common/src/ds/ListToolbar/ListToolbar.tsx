// Upstream to twake-ui: no, a layout detail of tmail-flutter: the toolbar
// above the list has 12 px of padding above and below, 16 px on the sides
// and between its controls, and a divider below.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

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
      sx={{
        gap: 2,
        py: '12px',
        px: 2,
        borderBottom: '1px solid #E7E8EC'
      }}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
