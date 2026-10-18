// Upstream to twake-ui: yes. Sign-in, consent and error pages of every
// Twake app put one card in the middle of the screen; twake-mui has the
// `Paper` but not the page layout around it.
import { Paper } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { MainLandmark } from '@/ds/MainLandmark/MainLandmark'

export interface CenteredCardProps {
  children: ReactNode
}

/**
 * An outlined card, at most 30 rem wide, centered in the available space.
 * The page around it is the `main` landmark.
 */
export function CenteredCard({ children }: CenteredCardProps): ReactElement {
  return (
    <MainLandmark className="u-flex u-flex-items-center u-flex-justify-center u-h-100 u-p-1">
      <Paper variant="outlined" className="u-w-100 u-maw-6 u-p-2">
        {children}
      </Paper>
    </MainLandmark>
  )
}
