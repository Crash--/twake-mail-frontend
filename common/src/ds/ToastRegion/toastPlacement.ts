/** The attribute of what a toast must not cover (a docked window) */
export const TOAST_AVOID = 'data-toast-avoid'
/**
 * The value of `TOAST_AVOID` on a bar (the answers of the reader): the toast
 * keeps its place beside the windows and goes above the bar under it
 */
export const TOAST_AVOID_BAR = 'bar'

/** Between a toast and what it avoids, and from the edge of the screen */
const GAP = 16
/** Narrowest room a toast is put in beside what it avoids */
const MIN_WIDTH = 280
/** Widest toast (`ds/ToastRegion`) */
export const TOAST_MAX_WIDTH = 424

export interface AvoidedBox {
  left: number
  top: number
  right: number
}

export type ToastPlacement =
  | { kind: 'center' }
  /**
   * Its right edge `right` px from the right of the screen; its bottom
   * `bottom` px from the bottom, null for the usual place
   */
  | { kind: 'beside'; right: number; maxWidth: number; bottom: number | null }
  /** Centred on `centerX`, its bottom `bottom` px from the bottom */
  | { kind: 'above'; bottom: number; centerX: number }

/**
 * Where a toast goes so as not to cover the boxes it avoids (the docked
 * windows, open or minimized): at the bottom centre without any; else
 * `GAP` before one of them, or right above one, aligned on it, raised
 * above the ones it would cover there, as low as can be; else above them
 * all. Then `GAP` above the bars under it there.
 */
export function placeToast(
  avoided: readonly AvoidedBox[],
  viewport: { width: number; height: number },
  bars: readonly AvoidedBox[] = []
): ToastPlacement {
  return liftAboveBars(placeBesideWindows(avoided, viewport), bars, viewport)
}

/** Left and right of the widest toast at a placement */
function toastSpan(
  placement: ToastPlacement,
  viewportWidth: number
): { left: number; right: number } {
  switch (placement.kind) {
    case 'beside': {
      const right = viewportWidth - placement.right
      return { left: right - placement.maxWidth, right }
    }
    case 'above':
      return {
        left: placement.centerX - TOAST_MAX_WIDTH / 2,
        right: placement.centerX + TOAST_MAX_WIDTH / 2
      }
    default:
      return {
        left: (viewportWidth - TOAST_MAX_WIDTH) / 2,
        right: (viewportWidth + TOAST_MAX_WIDTH) / 2
      }
  }
}

function liftAboveBars(
  placement: ToastPlacement,
  bars: readonly AvoidedBox[],
  viewport: { width: number; height: number }
): ToastPlacement {
  const span = toastSpan(placement, viewport.width)
  const under = bars.filter(
    bar => bar.left < span.right && bar.right > span.left
  )
  if (under.length === 0) return placement
  const bottom = viewport.height - Math.min(...under.map(bar => bar.top)) + GAP
  switch (placement.kind) {
    case 'beside':
      return { ...placement, bottom: Math.max(placement.bottom ?? 0, bottom) }
    case 'above':
      return { ...placement, bottom: Math.max(placement.bottom, bottom) }
    default:
      return { kind: 'above', bottom, centerX: viewport.width / 2 }
  }
}

function placeBesideWindows(
  avoided: readonly AvoidedBox[],
  viewport: { width: number; height: number }
): ToastPlacement {
  if (avoided.length === 0) return { kind: 'center' }
  // The right edge and width of each place tried: on the left of a box,
  // or right above one, aligned on it (a minimized window)
  const tries = avoided.flatMap(anchor => {
    const room = anchor.left - 2 * GAP
    const span = anchor.right - anchor.left
    return [
      { end: anchor.left - GAP, width: Math.min(TOAST_MAX_WIDTH, room) },
      { end: anchor.right, width: Math.min(TOAST_MAX_WIDTH, span) }
    ].filter(place => place.width >= MIN_WIDTH)
  })
  // Each raised above the boxes it would cover there; the lowest wins
  const places = tries.map(({ end, width }) => {
    const covered = avoided.filter(
      box => box.left < end && box.right > end - width
    )
    const bottom =
      covered.length === 0
        ? null
        : viewport.height - Math.min(...covered.map(box => box.top)) + GAP
    return {
      kind: 'beside' as const,
      right: viewport.width - end,
      maxWidth: width,
      bottom
    }
  })
  const best = places.reduce<(typeof places)[number] | null>(
    (lowest, place) =>
      lowest === null || (place.bottom ?? 0) < (lowest.bottom ?? 0)
        ? place
        : lowest,
    null
  )
  if (best !== null) return best
  const left = Math.min(...avoided.map(box => box.left))
  const top = Math.min(...avoided.map(box => box.top))
  const right = Math.max(...avoided.map(box => box.right))
  return {
    kind: 'above',
    bottom: viewport.height - top + GAP,
    centerX: (left + right) / 2
  }
}

/** Whether two placements put the toast at the same place */
export function isSamePlacement(a: ToastPlacement, b: ToastPlacement): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
