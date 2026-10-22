// Upstream to twake-ui: no, `LinearProgress` with a reduced-motion guard.
import { LinearProgress } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const HEIGHT = 3

export interface ThinProgressBarProps {
  /** Done, from 0 to 1; null while the total is unknown (indeterminate) */
  value: number | null
  /** Accessible name of the progress bar */
  label: string
  /** In px, 3 by default (2 for an image being inserted) */
  height?: number
  'data-testid'?: string
}

/** A thin progress bar (`role="progressbar"`) */
export function ThinProgressBar({
  value,
  label,
  height = HEIGHT,
  'data-testid': testId
}: ThinProgressBarProps): ReactElement {
  const percent =
    value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <LinearProgress
      variant={percent === null ? 'indeterminate' : 'determinate'}
      value={percent ?? undefined}
      aria-label={label}
      sx={{
        height,
        borderRadius: '4px',
        '@media (prefers-reduced-motion: reduce)': {
          '& .MuiLinearProgress-bar': { transition: 'none' },
          // Nothing slides: a static bar says that the total is unknown
          ...(percent === null
            ? {
                '& .MuiLinearProgress-bar1': {
                  animation: 'none',
                  left: 0,
                  right: 0,
                  opacity: 0.5
                },
                '& .MuiLinearProgress-bar2': { display: 'none' }
              }
            : {})
        }
      }}
      data-testid={testId}
    />
  )
}
