// Upstream to twake-ui: yes. A dialog that opens under an element of the
// page (tmail-flutter opens its advanced search as a white card 2 px under
// the search field, a 16 px radius and a soft shadow) instead of in the
// middle of the screen with a dimmed backdrop. twake-mui's `Dialog` is always centred; MUI's `Popover`
// has the placement but is not a dialog (no name, no role).
import { Fade, Popover } from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode } from 'react'

const PANEL_RADIUS = 16
/** tmail-flutter's `colorShadowComposer` (32 px) and drop shadow (4 px) */
const PANEL_SHADOW = '0 0 32px rgba(0, 0, 0, 0.12), 0 0 4px rgba(0, 0, 0, 0.08)'
/** A form does not fit a narrower card, whatever the anchor is */
const MIN_WIDTH = 560
/** Room kept above and below the panel on a short screen */
const SCREEN_MARGIN = 16

export interface AnchoredDialogProps {
  open: boolean
  /** The element the panel opens under: same left edge, same width */
  anchorEl: HTMLElement | null
  /** Escape, a click outside */
  onClose: () => void
  /** Name of the dialog for screen readers (visually hidden heading) */
  title: string
  children: ReactNode
  'data-testid'?: string
}

/**
 * A modal dialog laid under `anchorEl`: as wide as it (560 px at least), from
 * its bottom left corner, a white card with a soft shadow, scrolling when the screen is too
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
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
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
            mt: '2px',
            borderRadius: `${PANEL_RADIUS}px`,
            boxShadow: PANEL_SHADOW,
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
