// Upstream to twake-ui: yes, as options of `ExtendableFab`: a placement
// (`position="fixed"` at the bottom end, above the safe area), and a fold
// while any content scrolls. `ExtendableFab` folds on the window scroll only,
// past a threshold, and drops its label at once; the email list scrolls in
// its own box. twake-mui leaves the position to each app, which then needs
// `sx`.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Fab, styled, type SxProps, type Theme } from '@linagora/twake-mui'
import { useEffect, useState, type ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/** Distance to the edges of the screen, in theme spacing units */
const OFFSET = 2

/** Room the button takes at the bottom of the screen, for the content under it */
export const FLOATING_ACTION_INSET = 88

/**
 * The room to keep free at the end of scrolling content: the floating
 * button is there below the desktop size
 */
export function useFloatingActionInset(): number {
  return useScreenSize() === 'desktop' ? 0 : FLOATING_ACTION_INSET
}

/** Time without a scroll event after which the scrolling is over, in ms */
export const SCROLL_IDLE_DELAY = 250

/** The keys that scroll the box under the focus */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' '
])

/**
 * Whether the user scrolls the page: the window or any scrolling box. A
 * scroll counts when it follows a gesture of the user (wheel, finger, scroll
 * key) or goes on while already counted (a finger's momentum); a list that
 * scrolls itself back to where it was, back from an email, does not.
 */
function useIsPageScrolling(): boolean {
  const [isScrolling, setIsScrolling] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastGestureAt = Number.NEGATIVE_INFINITY
    let isOn = false
    const handleGesture = (): void => {
      lastGestureAt = performance.now()
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (SCROLL_KEYS.has(event.key)) handleGesture()
    }
    const handleScroll = (): void => {
      if (!isOn && performance.now() - lastGestureAt > SCROLL_IDLE_DELAY) {
        return
      }
      isOn = true
      setIsScrolling(true)
      clearTimeout(timer)
      timer = setTimeout(() => {
        isOn = false
        setIsScrolling(false)
      }, SCROLL_IDLE_DELAY)
    }
    // Scroll events do not bubble: the capture phase sees those of every box
    const options = { capture: true, passive: true }
    document.addEventListener('wheel', handleGesture, options)
    document.addEventListener('touchmove', handleGesture, options)
    document.addEventListener('keydown', handleKey, options)
    document.addEventListener('scroll', handleScroll, options)
    return () => {
      document.removeEventListener('wheel', handleGesture, options)
      document.removeEventListener('touchmove', handleGesture, options)
      document.removeEventListener('keydown', handleKey, options)
      document.removeEventListener('scroll', handleScroll, options)
      clearTimeout(timer)
    }
  }, [])
  return isScrolling
}

// The label shrinks to nothing, which leaves the square of the icon alone
// (twake-mui's extended Fab: 48 px high, 16 px of padding around the 16 px
// icon). A grid track from 1fr to 0fr follows the real width of the text,
// whatever its language. The text stays the accessible name of the button.
const Label = styled('span', {
  shouldForwardProp: prop => prop !== 'isFolded'
})<{ isFolded: boolean }>(({ theme, isFolded }) => ({
  display: 'grid',
  gridTemplateColumns: isFolded ? '0fr' : '1fr',
  marginLeft: isFolded ? 0 : theme.spacing(1),
  opacity: isFolded ? 0 : 1,
  transition: theme.transitions.create(
    ['grid-template-columns', 'margin', 'opacity'],
    { duration: theme.transitions.duration.short }
  ),
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none'
  }
}))

const LabelText = styled('span')({
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap'
})

const FAB_SX: SxProps<Theme> = theme => ({
  position: 'fixed',
  right: `calc(${theme.spacing(OFFSET)} + env(safe-area-inset-right))`,
  bottom: `calc(${theme.spacing(OFFSET)} + env(safe-area-inset-bottom))`,
  zIndex: theme.zIndex.speedDial
})

export interface FloatingActionButtonProps {
  /** Text and accessible name, e.g. "Compose" */
  label: string
  icon: IconProps['icon']
  onClick?: () => void
  'data-testid'?: string
}

/**
 * The main action of a screen on phones and tablets, floating at the bottom
 * end of the screen: twake-mui's extended `Fab`, with its label, folded to
 * its icon while the content scrolls. It stays under modal panels (drawer,
 * dialogs), which make it inert. Content that scrolls under it keeps
 * `FLOATING_ACTION_INSET` free at its end.
 */
export function FloatingActionButton({
  label,
  icon,
  onClick,
  'data-testid': testId
}: FloatingActionButtonProps): ReactElement {
  const isFolded = useIsPageScrolling()
  return (
    <Fab
      variant="extended"
      color="primary"
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
      data-folded={isFolded}
      sx={FAB_SX}
    >
      <Icon icon={icon} />
      <Label isFolded={isFolded}>
        <LabelText>{label}</LabelText>
      </Label>
    </Fab>
  )
}
