// Upstream to twake-ui: yes, as a `LinearProgress` variant. The sidebar
// gauge of the design is 3 px high, square, on `action.selected`, filled with
// the primary colour; twake-mui's progress bar is thicker and rounded.
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
  full: '#E64646'
} as const

const BAR_COLORS = {
  normal: 'primary',
  warning: 'warning',
  full: 'error'
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
      sx={theme =>
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
              borderRadius: 0,
              backgroundColor: theme.vars.palette.action.selected,
              '& .MuiLinearProgress-bar': { borderRadius: 0 }
            }
      }
    />
  )
}
