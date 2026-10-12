// Upstream to twake-ui: yes. A list and the item opened from it, one at a
// time or side by side depending on the room, is the master-detail pattern
// of every Twake app (mails, contacts, files); twake-mui has none.
import { Box, GlobalStyles } from '@linagora/twake-mui'
import type { CSSObject, Theme } from '@linagora/twake-mui'
import {
  useEffect,
  useRef,
  type FocusEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  useSlideBreakpoint,
  useScreenSize
} from '@/ds/useScreenSize/useScreenSize'
import {
  clearViewTransitionDirection,
  REDUCED_MOTION_QUERY,
  VIEW_TRANSITION_DIRECTION_ATTRIBUTE,
  VIEW_TRANSITION_DURATION_MS
} from '@/ds/ViewTransition/viewTransition'

/** Width of the list beside an open item (tmail-flutter tablet layout) */
export const SPLIT_LIST_WIDTH = 375

const LIST_PANE_SX = {
  width: SPLIT_LIST_WIDTH,
  borderRight: 1,
  borderColor: 'divider'
} as const

/**
 * `view-transition-name` of what changes when an item opens or closes: the
 * only pane of a one-at-a-time layout, the item pane beside the list
 */
const PANE_TRANSITION = 'list-detail-pane'
const ITEM_TRANSITION = 'list-detail-item'
const SINGLE_PANE_SX = { viewTransitionName: PANE_TRANSITION } as const
const ITEM_PANE_SX = { viewTransitionName: ITEM_TRANSITION } as const

const EASING = 'cubic-bezier(0.2, 0, 0, 1)'
const forward = `:root[${VIEW_TRANSITION_DIRECTION_ATTRIBUTE}="forward"]`
const backward = `:root[${VIEW_TRANSITION_DIRECTION_ATTRIBUTE}="backward"]`
const slide = (keyframes: string): string =>
  `${VIEW_TRANSITION_DURATION_MS}ms ${EASING} both ${keyframes}`
// Fade through: the old view goes, then the new one comes, never both
const FADE_OUT_MS = 90
const fadeOut = (keyframes: string): string =>
  `${FADE_OUT_MS}ms linear both ${keyframes}`
const fadeIn = (keyframes: string): string =>
  `${VIEW_TRANSITION_DURATION_MS - FADE_OUT_MS}ms ${EASING} ${FADE_OUT_MS}ms both ${keyframes}`

/**
 * The view transitions of a navigation run with `prepareViewTransition`:
 * - one view at a time below `slideBreakpoint` (900 px: phones, small
 *   tablets; 600 px under `WithoutTablets`): a swipe, the item coming in
 *   from the end while the list moves aside, the reverse when going back;
 * - otherwise (the item pane beside the list from 900 px, the item replacing
 *   the whole width on desktops): a lighter effect, the old view fading
 *   out, then the new one fading in with a short slide;
 * - a history traversal (back button of the browser) does not move;
 * - the rest of the page (top bar, sidebar) does not move, and nothing does
 *   with reduced motion; the pseudo-elements let the pointer through, the
 *   page under them is already the new one.
 */
function transitionStyles(theme: Theme, slideBreakpoint: number): CSSObject {
  return {
    '@keyframes list-detail-out-start': {
      to: { transform: 'translateX(-30%)', opacity: 0.6 }
    },
    '@keyframes list-detail-in-end': {
      from: { transform: 'translateX(100%)' }
    },
    '@keyframes list-detail-out-end': { to: { transform: 'translateX(100%)' } },
    '@keyframes list-detail-in-start': {
      from: { transform: 'translateX(-30%)', opacity: 0.6 }
    },
    '@keyframes list-detail-fade-out': { to: { opacity: 0 } },
    '@keyframes list-detail-fade-in-end': {
      from: { transform: 'translateX(24px)', opacity: 0 }
    },
    '@keyframes list-detail-fade-in-start': {
      from: { transform: 'translateX(-24px)', opacity: 0 }
    },
    '::view-transition': { pointerEvents: 'none' },
    '::view-transition-old(root), ::view-transition-new(root)': {
      animation: 'none'
    },
    // A transition without a direction (history traversal) does not move
    [`:root:not([${VIEW_TRANSITION_DIRECTION_ATTRIBUTE}])::view-transition-group(*), :root:not([${VIEW_TRANSITION_DIRECTION_ATTRIBUTE}])::view-transition-old(*), :root:not([${VIEW_TRANSITION_DIRECTION_ATTRIBUTE}])::view-transition-new(*)`]:
      { animation: 'none' },
    [`::view-transition-group(${PANE_TRANSITION}), ::view-transition-group(${ITEM_TRANSITION})`]:
      {
        animationDuration: `${VIEW_TRANSITION_DURATION_MS}ms`,
        // What slides stays within its pane
        overflow: 'clip'
      },
    // The panes are transparent: opaque pictures, or the one sliding over the
    // other would mix with it
    [`::view-transition-old(${PANE_TRANSITION}), ::view-transition-new(${PANE_TRANSITION}), ::view-transition-old(${ITEM_TRANSITION}), ::view-transition-new(${ITEM_TRANSITION})`]:
      { backgroundColor: theme.vars.palette.background.paper },
    // The pane leaving on top when going back
    [`${backward}::view-transition-old(${PANE_TRANSITION})`]: { zIndex: 1 },
    [`@media (max-width:${slideBreakpoint - 0.05}px)`]: {
      [`${forward}::view-transition-old(${PANE_TRANSITION})`]: {
        animation: slide('list-detail-out-start')
      },
      [`${forward}::view-transition-new(${PANE_TRANSITION})`]: {
        animation: slide('list-detail-in-end')
      },
      [`${backward}::view-transition-old(${PANE_TRANSITION})`]: {
        animation: slide('list-detail-out-end')
      },
      [`${backward}::view-transition-new(${PANE_TRANSITION})`]: {
        animation: slide('list-detail-in-start')
      }
    },
    [`@media (min-width:${slideBreakpoint}px)`]: {
      [`::view-transition-old(${PANE_TRANSITION}), ::view-transition-old(${ITEM_TRANSITION})`]:
        { animation: fadeOut('list-detail-fade-out') },
      [`${forward}::view-transition-new(${PANE_TRANSITION}), ${forward}::view-transition-new(${ITEM_TRANSITION})`]:
        { animation: fadeIn('list-detail-fade-in-end') },
      [`${backward}::view-transition-new(${PANE_TRANSITION}), ${backward}::view-transition-new(${ITEM_TRANSITION})`]:
        { animation: fadeIn('list-detail-fade-in-start') }
    },
    [`@media ${REDUCED_MOTION_QUERY}`]: {
      '::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)':
        { animation: 'none !important' }
    }
  }
}

export interface ListDetailLayoutProps {
  list: ReactNode
  /** The item opened from the list, null when none is */
  detail: ReactNode
  /** Beside the list when no item is open, on screens showing both */
  placeholder: ReactNode
}

function isFocusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body || !active.isConnected
}

/**
 * A list and the item opened from it.
 *
 * - From 900 to 1199 px, side by side, as tmail-flutter does on large
 *   tablets: the list keeps its width, its scroll and its focus while items
 *   open beside it, and a placeholder fills the room when none is open.
 *   Closing the item gives the focus back to where it was in the list.
 * - Otherwise one at a time, the item replacing the list: phones, small
 *   tablets, and desktops, where the list has the whole width.
 *
 * Only what is shown is rendered: nothing hidden can take the focus.
 * Navigations run as view transitions (`prepareViewTransition`) slide
 * between the list and the item, see `transitionStyles`.
 */
export function ListDetailLayout({
  list,
  detail,
  placeholder
}: ListDetailLayoutProps): ReactElement {
  const screenSize = useScreenSize()
  const slideBreakpoint = useSlideBreakpoint()
  const isSplit = screenSize === 'tabletLarge'
  // On desktops the pane is the scrolling area of the item: the view
  // transition snapshots a pane that does not move with the scroll, which it
  // would otherwise slide over the bars above it. Below, the page scrolls
  // (the sticky bars stick to it).
  const singlePaneClassName =
    screenSize === 'desktop'
      ? 'u-flex u-flex-column u-h-100 u-ov-auto'
      : 'u-flex u-flex-column u-h-100'
  const hasDetail = detail !== null && detail !== undefined
  const lastListFocusRef = useRef<HTMLElement | null>(null)
  const hadDetailRef = useRef(hasDetail)

  useEffect(() => {
    const hadDetail = hadDetailRef.current
    hadDetailRef.current = hasDetail
    const target = lastListFocusRef.current
    if (
      isSplit &&
      hadDetail &&
      !hasDetail &&
      isFocusLost() &&
      target?.isConnected
    ) {
      target.focus()
    }
  }, [isSplit, hasDetail])

  // The back and forward buttons of the browser: no slide, mobile browsers
  // animate their own back gesture
  useEffect(() => {
    const handlePopState = (): void => {
      clearViewTransitionDirection()
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const handleListFocus = (event: FocusEvent<HTMLElement>): void => {
    lastListFocusRef.current = event.target
  }

  const styles = (
    <GlobalStyles
      styles={(theme: Theme) => transitionStyles(theme, slideBreakpoint)}
    />
  )

  if (!isSplit) {
    // The same flex column as the parent of the layout: the list and the
    // item lay out as if they were its children
    return (
      <Box className={singlePaneClassName} sx={SINGLE_PANE_SX}>
        {styles}
        {hasDetail ? detail : list}
      </Box>
    )
  }

  return (
    <Box className="u-flex u-h-100">
      {styles}
      <Box
        className="u-flex u-flex-column u-flex-shrink-0 u-h-100"
        sx={LIST_PANE_SX}
        onFocus={handleListFocus}
      >
        {list}
      </Box>
      <Box className="u-flex-auto u-h-100 u-ov-auto" sx={ITEM_PANE_SX}>
        {hasDetail ? detail : placeholder}
      </Box>
    </Box>
  )
}
