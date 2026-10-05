export interface Viewport {
  width: number
  /** A touch screen: `(pointer: coarse)` and `(hover: none)` match */
  touch?: boolean
  /** `(prefers-reduced-motion: reduce)` matches */
  reducedMotion?: boolean
}

type MatchMedia = (query: string) => MediaQueryList

function matchesCondition(condition: string, viewport: Viewport): boolean {
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
  return (query: string): MediaQueryList => ({
    matches: matchesViewport(query, viewport),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
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
