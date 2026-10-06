// Upstream to twake-ui: yes. A skeleton is a picture of content to come:
// whatever draws one needs it hidden to assistive technologies, its
// container marked busy, and no shimmer for people who ask for less motion.
// twake-mui's `Skeleton` and `ListSkeleton` do none of the three.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const REGION_SX = {
  // The pulse of a skeleton is an animation: not for `prefers-reduced-motion`
  '@media (prefers-reduced-motion: reduce)': {
    '& .MuiSkeleton-root, & .MuiSkeleton-root::after': {
      animation: 'none'
    }
  }
} as const

export interface SkeletonRegionProps {
  /** The skeleton shapes, e.g. twake-mui `Skeleton`s */
  children: ReactNode
  className?: string
  /** Receives the container, e.g. to measure it */
  rootRef?: (element: HTMLElement | null) => void
  'data-testid'?: string
}

/**
 * Wraps skeleton shapes standing for content that is loading: the container
 * is `aria-busy`, the shapes are hidden to screen readers, which are told
 * once, by a live region of the page, and nothing moves when the user asks
 * for reduced motion.
 */
export function SkeletonRegion({
  children,
  className,
  rootRef,
  'data-testid': testId
}: SkeletonRegionProps): ReactElement {
  return (
    <Box
      ref={rootRef}
      className={className}
      aria-busy="true"
      sx={REGION_SX}
      data-testid={testId}
    >
      <Box aria-hidden="true" className="u-h-100">
        {children}
      </Box>
    </Box>
  )
}
