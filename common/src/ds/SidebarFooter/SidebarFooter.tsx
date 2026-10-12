// Upstream to twake-ui: yes, as the `footer` of `Nav`. The foot of the
// sidebar, as tmail-flutter's `LinagoraSidebarFooter`: 24 px of padding
// sides and bottom, the storage and its actions, then, 12 px under them, the
// version centred in 11/14 regular text, Steel gray 400.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

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
            m: 0,
            // 12 px under what comes before, as tmail-flutter's footer
            '* + &': { mt: '12px' },
            color: TMAIL.grey,
            fontSize: 11,
            fontWeight: 400,
            lineHeight: '14px',
            letterSpacing: 0,
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
