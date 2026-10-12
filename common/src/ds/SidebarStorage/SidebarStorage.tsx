// Upstream to twake-ui: yes, as the storage block of a `Nav` footer. The
// look of tmail-flutter's `LinagoraSidebarStorage`: a 24 px icon, the name
// 8 px after it in Medium 12, a 24 px refresh button at the end; 12 px
// under them a 3 px gauge, 12 px under it what is left.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** tmail-flutter's storage text: Medium 12 / 15.76, tracked by 0.5 */
const TEXT_SX = {
  m: 0,
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '15.76px',
  letterSpacing: 0.5
} as const

/** The grey of the storage text, and the red of a full storage */
const TEXT_COLOR = TMAIL.textGrey64
const ERROR_COLOR = TMAIL.error

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
          color: TMAIL.textGrey90,
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
          sx={{ ...TEXT_SX, color: TEXT_COLOR }}
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
          color: isError ? ERROR_COLOR : TEXT_COLOR,
          whiteSpace: 'pre-line'
        }}
      >
        {status}
      </Box>
    </Box>
  )
}
