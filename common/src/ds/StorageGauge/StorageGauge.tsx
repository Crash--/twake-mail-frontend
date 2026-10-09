// Upstream to twake-ui: yes, as a `LinearProgress` variant. The sidebar
// gauge of tmail-flutter (`LinagoraSidebarStorage`) is 3 px high, rounded by
// 1.5 px, on the selected tint of the sidebar, filled with #0A84FF, #FFB300
// past the warning limit, #FF3347 when full; twake-mui's progress bar is
// thicker and in the theme colours.
import { LinearProgress } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

export interface StorageGaugeProps {
  /** Share used, from 0 to 100 */
  value: number
  /** Warning limit reached, or full: the bar changes colour */
  state?: 'normal' | 'warning' | 'full'
  /** Id of the element naming the gauge */
  labelledBy: string
  /** What the gauge reads, for screen readers ("1 MB of 50 MB used") */
  valueText: string
  /**
   * `settings`: the bar of tmail-flutter's Storage settings, 4.5 px high,
   * rounded, light blue (#25AEFE) on a light grey track
   */
  look?: 'sidebar' | 'settings'
  className?: string
  'data-testid'?: string
}

const SETTINGS_BAR_COLORS = {
  normal: '#25AEFE',
  warning: '#FFC107',
  full: TMAIL.errorLogin
} as const

const BAR_COLORS = {
  normal: 'primary',
  warning: 'warning',
  full: 'error'
} as const

const SIDEBAR_BAR_COLORS = {
  normal: TMAIL.primary0A,
  warning: '#FFB300',
  full: TMAIL.error
} as const

/** The thin gauge of the used storage, at the foot of the sidebar */
export function StorageGauge({
  value,
  state = 'normal',
  labelledBy,
  valueText,
  look = 'sidebar',
  className,
  'data-testid': testId
}: StorageGaugeProps): ReactElement {
  const isSettings = look === 'settings'
  return (
    <LinearProgress
      variant="determinate"
      value={Math.min(100, Math.max(0, value))}
      color={BAR_COLORS[state]}
      aria-labelledby={labelledBy}
      aria-valuetext={valueText}
      className={className}
      data-testid={testId}
      sx={
        isSettings
          ? {
              height: 4.5,
              borderRadius: '13px',
              backgroundColor: TMAIL.fillF7,
              '& .MuiLinearProgress-bar': {
                borderRadius: '13px',
                backgroundColor: SETTINGS_BAR_COLORS[state]
              }
            }
          : {
              height: 3,
              borderRadius: '1.5px',
              backgroundColor: TMAIL.selectedInk,
              '& .MuiLinearProgress-bar': {
                borderRadius: '1.5px',
                backgroundColor: SIDEBAR_BAR_COLORS[state]
              }
            }
      }
    />
  )
}
