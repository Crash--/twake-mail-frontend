// Upstream to twake-ui: yes, as a `LinearProgress` variant. The sidebar
// gauge of the design is 3 px high, square, on `action.selected`, filled with
// the primary colour; twake-mui's progress bar is thicker and rounded.
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
  className,
  'data-testid': testId
}: StorageGaugeProps): ReactElement {
  return (
    <LinearProgress
      variant="determinate"
      value={Math.min(100, Math.max(0, value))}
      color={BAR_COLORS[state]}
      aria-labelledby={labelledBy}
      aria-valuetext={valueText}
      className={className}
      data-testid={testId}
      sx={theme => ({
        height: 3,
        borderRadius: 0,
        backgroundColor: theme.palette.action.selected,
        '& .MuiLinearProgress-bar': { borderRadius: 0 }
      })}
    />
  )
}
