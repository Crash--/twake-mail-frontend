// Upstream to twake-ui: no, tmail-flutter's tooltip of the links of an
// email (`IframeTooltipOverlay`): the address of the link under it (above
// it near the bottom of the screen), black, a 6 px radius, white 13 px text
// on one line, at most 400 px wide, faded in over 130 ms. MUI's `Tooltip`
// cannot anchor to an element of another document (the iframe of the body).
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const WIDTH = 400
const HEIGHT = 28
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
      sx={{
        position: 'fixed',
        top,
        left,
        zIndex: 'tooltip',
        maxWidth: width,
        minHeight: HEIGHT,
        boxSizing: 'border-box',
        px: 1,
        py: '5px',
        borderRadius: '6px',
        bgcolor: '#000000',
        color: '#FFFFFF',
        fontSize: 13,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.15)',
        '@keyframes linkTooltipIn': {
          from: {
            opacity: 0,
            transform: `translateY(${isAbove ? -8 : 8}px)`
          },
          to: { opacity: 1, transform: 'none' }
        },
        animation: 'linkTooltipIn 130ms ease-out',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
      }}
    >
      {href}
    </Box>
  )
}
