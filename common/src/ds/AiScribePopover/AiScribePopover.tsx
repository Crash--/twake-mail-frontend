// Upstream to twake-ui: no, the placement of tmail-flutter's AI assistant
// (`AiScribeModalWidget`): what it opens floats over the composer, its
// bottom left corner 8 px above the button that opened it (its top left
// corner 8 px under it where the screen lacks room above), without a backdrop;
// the pieces inside (menu, prompt bar) draw their own cards.
import { Box, Popover } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

/** Room kept between the cards and the edges of the screen */
const SCREEN_MARGIN = 16
/** Between the button and the cards */
const ANCHOR_GAP = 8

export interface AiScribePopoverProps {
  open: boolean
  /** The button the cards open above */
  anchorEl: HTMLElement | null
  /** Escape, a click outside */
  onClose: () => void
  /** Accessible name of the group of cards */
  label: string
  children: ReactNode
  'data-testid'?: string
}

/**
 * The cards of the AI assistant, above the button that opened them, one
 * under the other 8 px apart, left aligned. Escape and a click outside
 * close them, and the focus goes back to the button.
 */
export function AiScribePopover({
  open,
  anchorEl,
  onClose,
  label,
  children,
  'data-testid': testId
}: AiScribePopoverProps): ReactElement {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      disableScrollLock
      marginThreshold={SCREEN_MARGIN}
      transitionDuration={0}
      data-testid={testId}
      slotProps={{
        paper: {
          'aria-label': label,
          sx: {
            mt: `-${ANCHOR_GAP}px`,
            overflow: 'visible',
            bgcolor: 'transparent',
            boxShadow: 'none',
            borderRadius: 0
          }
        }
      }}
    >
      <Box
        className="u-flex u-flex-column"
        sx={{ gap: '8px', alignItems: 'flex-start' }}
      >
        {children}
      </Box>
    </Popover>
  )
}
