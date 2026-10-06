// Upstream to twake-ui: yes. A dialog that opens over an element of the page
// (the search field of the Twake Mail design opens its advanced search as a
// white card in its place) instead of in the middle of the screen with a
// dimmed backdrop. twake-mui's `Dialog` is always centred; MUI's `Popover`
// has the placement but is not a dialog (no name, no role).
import { Fade, Popover } from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode } from 'react'

const PANEL_RADIUS = 24
/** A form does not fit a narrower card, whatever the anchor is */
const MIN_WIDTH = 560
/** Room kept above and below the panel on a short screen */
const SCREEN_MARGIN = 16

export interface AnchoredDialogProps {
  open: boolean
  /** The element the panel opens over: same top left corner, same width */
  anchorEl: HTMLElement | null
  /** Escape, a click outside */
  onClose: () => void
  /** Name of the dialog for screen readers (visually hidden heading) */
  title: string
  children: ReactNode
  'data-testid'?: string
}

/**
 * A modal dialog laid over `anchorEl`: as wide as it (560 px at least), from
 * its top left corner, a white card with a soft shadow, scrolling when the screen is too
 * short. The focus is trapped inside, Escape and a click outside close it,
 * and the focus goes back to what opened it. Named by `title`.
 */
export function AnchoredDialog({
  open,
  anchorEl,
  onClose,
  title,
  children,
  'data-testid': testId
}: AnchoredDialogProps): ReactElement {
  const titleId = useId()
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      // No shift of the page when the scroll bar goes
      disableScrollLock
      marginThreshold={SCREEN_MARGIN}
      data-testid={testId}
      // A fade: the card keeps its size while it shows (no scale from a corner)
      slots={{ transition: Fade }}
      transitionDuration={150}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-labelledby': titleId,
          sx: {
            width: anchorEl?.offsetWidth,
            minWidth: `min(${MIN_WIDTH}px, calc(100% - ${2 * SCREEN_MARGIN}px))`,
            maxWidth: `calc(100% - ${2 * SCREEN_MARGIN}px)`,
            borderRadius: `${PANEL_RADIUS}px`,
            boxShadow: 8,
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none !important'
            }
          }
        }
      }}
    >
      <h2 id={titleId} className="u-visuallyhidden">
        {title}
      </h2>
      {children}
    </Popover>
  )
}
