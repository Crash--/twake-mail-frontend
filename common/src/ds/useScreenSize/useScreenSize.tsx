// Upstream to twake-ui: yes, with these values or as theme breakpoints.
// twake-mui has `useBreakpoints` on its theme keys (md 769, lg 1024), made
// for the Cozy bottom navigation bar; a mail client follows the breakpoints
// of tmail-flutter (`ResponsiveUtils`), which Twake Mail users know: one
// pane below 900 px, the folders in a drawer below 1200 px.
import { useMediaQuery } from '@linagora/twake-mui'
import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

/** Smallest width of each screen size, in CSS pixels (tmail-flutter) */
export const SCREEN_BREAKPOINTS = {
  tablet: 600,
  tabletLarge: 900,
  desktop: 1200
} as const

/**
 * - `mobile`: below 600 px, one view at a time, folders in a drawer
 * - `tablet`: 600 to 899 px, the same with more room
 * - `tabletLarge`: 900 to 1199 px, list and reading side by side, folders in
 *   a drawer
 * - `desktop`: 1200 px and more, the sidebar is always shown
 */
export type ScreenSize = 'mobile' | 'tablet' | 'tabletLarge' | 'desktop'

function below(width: number): string {
  // The .05 keeps fractional widths (zoom) on one side only, as MUI does
  return `(max-width:${width - 0.05}px)`
}

/** Media queries of the screen sizes, for `sx` and `GlobalStyles` */
export const SCREEN_QUERIES = {
  mobile: below(SCREEN_BREAKPOINTS.tablet),
  belowTabletLarge: below(SCREEN_BREAKPOINTS.tabletLarge),
  belowDesktop: below(SCREEN_BREAKPOINTS.desktop),
  /** Fingers rather than a mouse: touch targets of 44 px (WCAG 2.5.5) */
  touch: '(pointer: coarse)'
} as const

const MEDIA_OPTIONS = { noSsr: true } as const

const WithoutTabletsContext = createContext(false)

/**
 * The screens below have two layouts only: `mobile` below 600 px, `desktop`
 * from there (a frame narrower than the screen, where the tablet layouts
 * would show for a desktop user)
 */
export function WithoutTablets({
  children
}: {
  children: ReactNode
}): ReactElement {
  return (
    <WithoutTabletsContext.Provider value>
      {children}
    </WithoutTabletsContext.Provider>
  )
}

/**
 * Width below which an item opened from a list slides in over it, as on a
 * phone (phones and small tablets): 900 px, 600 px under `WithoutTablets`
 */
export function useSlideBreakpoint(): number {
  return useContext(WithoutTabletsContext)
    ? SCREEN_BREAKPOINTS.tablet
    : SCREEN_BREAKPOINTS.tabletLarge
}

/**
 * The size class of the viewport. Without `matchMedia` (jsdom, server
 * rendering) every query is false: the screen is a desktop, the layout the
 * app had before it was responsive.
 */
export function useScreenSize(): ScreenSize {
  const isWithoutTablets = useContext(WithoutTabletsContext)
  // noSsr: the first render already has the right size, no desktop flash
  const isMobile = useMediaQuery(SCREEN_QUERIES.mobile, MEDIA_OPTIONS)
  const isBelowTabletLarge = useMediaQuery(
    SCREEN_QUERIES.belowTabletLarge,
    MEDIA_OPTIONS
  )
  const isBelowDesktop = useMediaQuery(
    SCREEN_QUERIES.belowDesktop,
    MEDIA_OPTIONS
  )

  if (isMobile) return 'mobile'
  if (isWithoutTablets) return 'desktop'
  if (isBelowTabletLarge) return 'tablet'
  if (isBelowDesktop) return 'tabletLarge'
  return 'desktop'
}
