// Upstream to twake-ui: yes. twake-mui does not export MUI's
// `LinearProgress`; tmail-flutter shows the progress of a long folder action
// (mark as read, empty) as a 3 px bar, primary on a light grey track with
// rounded ends (`horizontalPercentLoadingWidget`), sliding while the total
// is unknown (`horizontalLoadingWidget`).
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** `AppColor.colorBgMailboxSelected` of tmail-flutter */
const TRACK_COLOR = TMAIL.fillTrack
const HEIGHT = 3

export interface ThinProgressBarProps {
  /** Done, from 0 to 1; null while the total is unknown (indeterminate) */
  value: number | null
  /** Accessible name of the progress bar */
  label: string
  /** In px, 3 by default (2 for an image being inserted, as tmail-flutter) */
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
    <Box
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height,
        borderRadius: '4px',
        bgcolor: TRACK_COLOR
      }}
      data-testid={testId}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          borderRadius: '4px',
          bgcolor: 'primary.main',
          ...(percent === null
            ? {
                width: '30%',
                '@keyframes thin-progress-slide': {
                  from: { left: '-30%' },
                  to: { left: '100%' }
                },
                animation: 'thin-progress-slide 1.5s linear infinite',
                '@media (prefers-reduced-motion: reduce)': {
                  animation: 'none',
                  left: 0,
                  width: '100%',
                  opacity: 0.5
                }
              }
            : {
                left: 0,
                width: `${percent}%`,
                transition: 'width 0.2s linear',
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none'
                }
              })
        }}
      />
    </Box>
  )
}
