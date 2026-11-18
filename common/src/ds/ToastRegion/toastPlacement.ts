/** The attribute of what a toast must not cover (a docked window) */
export const TOAST_AVOID = 'data-toast-avoid'

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
 * all
 */
export function placeToast(
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
