// Upstream to twake-ui: yes, as the storage block of a `Nav` footer: a 24 px
// icon, the name 8 px after it in caption text, a 24 px refresh button at
// the end; 12 px under them a 3 px gauge, 12 px under it what is left.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const TEXT_SX = { m: 0, typography: 'caption' } as const

export interface SidebarStorageProps {
  /** The 24 px icon, an `Icon` */
  icon: ReactNode
  /** Its id, to name the gauge */
  labelId: string
  label: string
  /** The refresh button, a `NavSectionAction` */
  action: ReactNode
  /** The gauge, a `StorageGauge` */
  gauge: ReactNode
  /** What is left, or that the storage is full */
  status: string
  isError?: boolean
  statusTestId?: string
}

/** The storage used, at the foot of a sidebar */
export function SidebarStorage({
  icon,
  labelId,
  label,
  action,
  gauge,
  status,
  isError = false,
  statusTestId
}: SidebarStorageProps): ReactElement {
  return (
    <Box className="u-flex u-flex-column" sx={{ gap: '12px' }}>
      <Box
        className="u-flex u-flex-items-center"
        // The icon and the refresh in the colour of the names of the sidebar
        sx={{
          gap: '8px',
          color: 'text.primary',
          '& .MuiIconButton-root': { color: 'inherit' }
        }}
      >
        <Box component="span" aria-hidden="true" className="u-flex">
          {icon}
        </Box>
        <Box
          component="p"
          id={labelId}
          className="u-flex-auto u-ellipsis"
          sx={{ ...TEXT_SX, color: 'text.secondary' }}
        >
          {label}
        </Box>
        {action}
      </Box>
      {gauge}
      <Box
        component="p"
        data-testid={statusTestId}
        sx={{
          ...TEXT_SX,
          color: isError ? 'error.main' : 'text.secondary',
          whiteSpace: 'pre-line'
        }}
      >
        {status}
      </Box>
    </Box>
  )
}
