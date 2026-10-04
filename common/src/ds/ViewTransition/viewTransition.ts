// Upstream to twake-ui: yes. Every Twake app with a list and an item opened
// from it (mails, contacts, files) can slide between them the same way; the
// decision (API support, reduced motion) and the direction are not specific
// to mail.

/** Which way a view transition goes: into an item, or back to its list */
export type ViewTransitionDirection = 'forward' | 'backward'

/** Set on `<html>`: the styles of a transition pick its direction from it */
export const VIEW_TRANSITION_DIRECTION_ATTRIBUTE = 'data-view-transition'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Duration of the slides, short enough not to slow down opening an item */
export const VIEW_TRANSITION_DURATION_MS = 220

/** What the helpers read of the window */
export interface ViewTransitionHost {
  document: {
    documentElement: Pick<Element, 'setAttribute' | 'removeAttribute'>
    startViewTransition?: unknown
  }
  matchMedia?: (query: string) => { matches: boolean }
}

function prefersReducedMotion(view: ViewTransitionHost): boolean {
  return view.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false
}

/**
 * Whether a view transition may run: the browser has the View Transitions
 * API and the user did not ask for reduced motion (RGAA 4.1, WCAG 2.3.3).
 */
export function canAnimateViewTransition(
  view: ViewTransitionHost = window
): boolean {
  return (
    // Missing from older browsers (Firefox before 144)
    typeof view.document.startViewTransition === 'function' &&
    !prefersReducedMotion(view)
  )
}

/**
 * Prepares the view transition of a navigation that goes `direction`, and
 * says whether to run one: pass the result as the `viewTransition` option
 * of the router navigation. Without the API, or with reduced motion, it is
 * `false` and the navigation happens at once, as without animation.
 *
 * The direction stays on `<html>` until the next call: the transition
 * pseudo-elements it styles only exist while a transition runs.
 */
export function prepareViewTransition(
  direction: ViewTransitionDirection,
  view: ViewTransitionHost = window
): boolean {
  if (!canAnimateViewTransition(view)) return false
  view.document.documentElement.setAttribute(
    VIEW_TRANSITION_DIRECTION_ATTRIBUTE,
    direction
  )
  return true
}

/**
 * Forgets the direction of the last transition. A history traversal (the
 * back button or gesture of the browser, which animates its own) may run a
 * transition too: without a direction it does not move.
 */
export function clearViewTransitionDirection(
  view: ViewTransitionHost = window
): void {
  view.document.documentElement.removeAttribute(
    VIEW_TRANSITION_DIRECTION_ATTRIBUTE
  )
}
