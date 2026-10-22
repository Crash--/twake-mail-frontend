// Upstream to twake-ui: no, MUI's `Tooltip` cannot anchor to an element of
// another document (the iframe of the body): this one is placed by hand
// with the look of the theme's tooltip.
import { alpha, Box, radius } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const WIDTH = 400
const HEIGHT = 37
const MARGIN = 12
const GAP = 4

/** Where a link is, in the coordinates of the window of the app */
export interface LinkRect {
  top: number
  left: number
  bottom: number
}

export interface LinkTooltipProps {
  /** The address the link leads to */
  href: string
  rect: LinkRect
  'data-testid'?: string
}

/** The address of a hovered link, beside it */
export function LinkTooltip({
  href,
  rect,
  'data-testid': testId
}: LinkTooltipProps): ReactElement {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const width = viewportWidth < WIDTH ? viewportWidth - MARGIN * 2 : WIDTH
  const isAbove = rect.bottom + HEIGHT + GAP > viewportHeight
  const top = isAbove ? rect.top - HEIGHT - GAP : rect.bottom + GAP
  let left = rect.left
  if (left + width > viewportWidth) left = viewportWidth - width - MARGIN
  if (left < MARGIN) left = MARGIN
  return (
    // The link itself names where it leads: what the eye sees here only
    <Box
      aria-hidden="true"
      data-testid={testId}
      sx={theme => ({
        position: 'fixed',
        top,
        left,
        zIndex: 'tooltip',
        maxWidth: width,
        minHeight: HEIGHT,
        boxSizing: 'border-box',
        px: '12px',
        py: '8px',
        borderRadius: radius.sm,
        bgcolor: alpha(theme.palette.grey[800], 0.9),
        color: theme.palette.common.white,
        fontSize: 16,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none',
        '@keyframes linkTooltipIn': {
          from: {
            opacity: 0,
            transform: `translateY(${isAbove ? -8 : 8}px)`
          },
          to: { opacity: 1, transform: 'none' }
        },
        animation: 'linkTooltipIn 130ms ease-out',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
      })}
    >
      {href}
    </Box>
  )
}
