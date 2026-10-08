// Upstream to twake-ui: yes, as the `footer` of `Nav`. The foot of the
// sidebar of the design: 24 px of padding sides and bottom, the storage and
// its actions, then the version centred in an overline, Steel gray 400.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface SidebarFooterProps {
  children?: ReactNode
  /** The version line ("version 0.13.2"), centred under the children */
  version?: string
  'data-testid'?: string
  versionTestId?: string
}

/** The foot of a sidebar: what it holds, and the version of the app */
export function SidebarFooter({
  children,
  version,
  'data-testid': testId,
  versionTestId
}: SidebarFooterProps): ReactElement {
  return (
    <Box data-testid={testId} sx={{ px: 3, pb: 3, flexShrink: 0 }}>
      {children}
      {version === undefined ? null : (
        <Typography
          variant="overline"
          component="p"
          align="center"
          data-testid={versionTestId}
          sx={theme => ({
            mt: 1,
            mb: 0,
            color: '#818C99',
            textTransform: 'none',
            ...theme.applyStyles('dark', { color: 'rgba(255, 255, 255, 0.64)' })
          })}
        >
          {version}
        </Typography>
      )}
    </Box>
  )
}
