// Upstream to twake-ui: yes, with these values or as theme breakpoints.
// twake-mui has `useBreakpoints` on its theme keys (md 769, lg 1024), made
// for the Cozy bottom navigation bar; a mail client follows the breakpoints
// of tmail-flutter (`ResponsiveUtils`), which Twake Mail users know: one
// pane below 900 px, the folders in a drawer below 1200 px.
import { useMediaQuery } from '@linagora/twake-mui'
import {
  createContext,
  useContext,
  useSyncExternalStore,
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

const SIZE_QUERIES = [
  SCREEN_QUERIES.mobile,
  SCREEN_QUERIES.belowTabletLarge,
  SCREEN_QUERIES.belowDesktop
] as const

/** The size of the screen from the matches of `SIZE_QUERIES`, in order */
function sizeOf(matches: readonly boolean[]): ScreenSize {
  const [isMobile, isBelowTabletLarge, isBelowDesktop] = matches
  if (isMobile === true) return 'mobile'
  if (isBelowTabletLarge === true) return 'tablet'
  if (isBelowDesktop === true) return 'tabletLarge'
  return 'desktop'
}

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && 'matchMedia' in window
}

/** Which `matchMedia` the window has, to tell when it is replaced */
function matchMediaIdentity(): unknown {
  return hasMatchMedia() ? Reflect.get(window, 'matchMedia') : null
}

function openSizeLists(): MediaQueryList[] {
  return hasMatchMedia()
    ? SIZE_QUERIES.map(query => window.matchMedia(query))
    : []
}

/**
 * Without `matchMedia` (jsdom, server rendering) every query is false: the
 * screen is a desktop
 */
function readScreenSize(): ScreenSize {
  return sizeOf(openSizeLists().map(list => list.matches))
}

/**
 * One set of `matchMedia` listeners for the whole app, shared by every
 * `useScreenSize()`: a list row reading the size no longer opens its own
 * three, and its readers hear of a change only when the size class changes
 * (issue #1091). The lists are opened with the first reader and closed with
 * the last one.
 */
interface ScreenSizeStore {
  listeners: Set<() => void>
  /** The `matchMedia` the lists come from */
  source: unknown
  mediaLists: MediaQueryList[]
  current: ScreenSize
}

const store: ScreenSizeStore = {
  listeners: new Set(),
  source: null,
  mediaLists: [],
  current: 'desktop'
}

function handleMediaChange(): void {
  const next = sizeOf(store.mediaLists.map(list => list.matches))
  if (next === store.current) return
  store.current = next
  store.listeners.forEach(listener => {
    listener()
  })
}

function openMediaLists(): void {
  store.source = matchMediaIdentity()
  store.mediaLists = openSizeLists()
  store.mediaLists.forEach(list => {
    list.addEventListener('change', handleMediaChange)
  })
  store.current = sizeOf(store.mediaLists.map(list => list.matches))
}

function closeMediaLists(): void {
  store.mediaLists.forEach(list => {
    list.removeEventListener('change', handleMediaChange)
  })
  store.mediaLists = []
  store.source = null
}

function subscribe(listener: () => void): () => void {
  if (store.listeners.size === 0) openMediaLists()
  store.listeners.add(listener)
  return (): void => {
    store.listeners.delete(listener)
    if (store.listeners.size === 0) closeMediaLists()
  }
}

function getSnapshot(): ScreenSize {
  // Read on the spot until a reader listens (the first render already has
  // the right size, no desktop flash), or once `matchMedia` was replaced
  // (a test giving jsdom another screen)
  return store.listeners.size > 0 && matchMediaIdentity() === store.source
    ? store.current
    : readScreenSize()
}

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
  const screenSize = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return isWithoutTablets && screenSize !== 'mobile' ? 'desktop' : screenSize
}

/**
 * A phone, or a tablet size with a touch screen: the screens held in the
 * hand, where rows are selected with the fingers (a long press). A tablet
 * size with a mouse is not one of them
 */
export function useIsHandheld(): boolean {
  const screenSize = useScreenSize()
  const isTouch = useMediaQuery(SCREEN_QUERIES.touch, MEDIA_OPTIONS)
  return screenSize === 'mobile' || (screenSize !== 'desktop' && isTouch)
}
