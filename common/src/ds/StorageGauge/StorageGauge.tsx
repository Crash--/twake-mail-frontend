// Upstream to twake-ui: yes, as a `LinearProgress` variant. The sidebar
// gauge is 3 px high, rounded by 1.5 px, on the selected tint, filled with
// the primary colour, warning past the limit, error when full; twake-mui's
// progress bar is thicker.
import { LinearProgress } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

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
   * `settings`: the bar of the Storage settings, 4.5 px high, rounded
   */
  look?: 'sidebar' | 'settings'
  className?: string
  'data-testid'?: string
}

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
      sx={
        isSettings
          ? {
              height: 4.5,
              borderRadius: '13px',
              backgroundColor: 'action.selected',
              '& .MuiLinearProgress-bar': { borderRadius: '13px' }
            }
          : {
              height: 3,
              borderRadius: '1.5px',
              backgroundColor: 'action.selected',
              '& .MuiLinearProgress-bar': { borderRadius: '1.5px' }
            }
      }
    />
  )
}
