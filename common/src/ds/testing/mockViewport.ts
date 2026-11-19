export interface Viewport {
  width: number
  /** A touch screen: `(pointer: coarse)` and `(hover: none)` match */
  touch?: boolean
  /** `(prefers-reduced-motion: reduce)` matches */
  reducedMotion?: boolean
}

/** A media query list without its deprecated listeners, added apart */
export type MediaQueryListMock = Omit<
  MediaQueryList,
  'addListener' | 'removeListener'
>

/**
 * MUI's `useCurrentColorScheme` still calls the deprecated `addListener`
 * (old Safari): spread into a mock, outside of its `MediaQueryList` type
 */
export const LEGACY_MEDIA_LISTENERS = {
  addListener: () => undefined,
  removeListener: () => undefined
}

type MatchMedia = (query: string) => MediaQueryListMock

function matchesCondition(condition: string, viewport: Viewport): boolean {
  // `(not (pointer: coarse))`: the opposite of the condition inside
  const negated = /^\s*\(\s*not\s+(\(.*\))\s*\)\s*$/.exec(condition)
  if (negated) return !matchesCondition(negated[1] ?? '', viewport)
  const feature = /\(\s*([a-z-]+)\s*:\s*([^)]+?)\s*\)/.exec(condition)
  if (!feature) return false
  const [, name, rawValue = ''] = feature
  const touch = viewport.touch ?? false
  switch (name) {
    case 'min-width':
      return viewport.width >= Number.parseFloat(rawValue)
    case 'max-width':
      return viewport.width <= Number.parseFloat(rawValue)
    case 'pointer':
      return rawValue === (touch ? 'coarse' : 'fine')
    case 'prefers-reduced-motion':
      return rawValue === 'reduce' && (viewport.reducedMotion ?? false)
    case 'hover':
      return rawValue === (touch ? 'none' : 'hover')
    default:
      return false
  }
}

/** `a and b, c`: any comma separated list whose conditions all match */
export function matchesViewport(query: string, viewport: Viewport): boolean {
  return query
    .replace(/^@media\s*/, '')
    .split(',')
    .some(list =>
      list
        .split(/\band\b/)
        .every(condition => matchesCondition(condition, viewport))
    )
}

function makeMatchMedia(viewport: Viewport): MatchMedia {
  return (query: string): MediaQueryListMock => ({
    ...LEGACY_MEDIA_LISTENERS,
    matches: matchesViewport(query, viewport),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
}

/**
 * Gives jsdom a `window.matchMedia` answering width, pointer and hover
 * queries as a screen of that size would. Call it before rendering, and
 * `resetViewport` after the test: jsdom has no `matchMedia`, which the
 * components read as a desktop.
 */
export function mockViewport(viewport: Viewport): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: makeMatchMedia(viewport)
  })
}

export function resetViewport(): void {
  Reflect.deleteProperty(window, 'matchMedia')
}
