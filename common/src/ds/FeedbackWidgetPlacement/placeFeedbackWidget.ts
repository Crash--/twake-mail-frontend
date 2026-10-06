// Upstream to twake-ui: no. It moves the host of a third party widget (the
// Sentry feedback button) that has no prop for it; the day twake-ui offers a
// feedback entry, this goes away.

export interface FeedbackWidgetPlacement {
  /**
   * Room to keep free at the bottom of the screen, in px, for a button of the
   * app that floats there (0: none). The button of the widget sits above it.
   */
  bottomClearance: number
  /** Stacking order of the button and of its form */
  zIndex: number
}

/**
 * Places the floating button of the Sentry feedback widget. The widget draws
 * itself in a shadow tree under a host element of the page and reads its
 * position and stacking order from CSS custom properties (`--inset`,
 * `--z-index`, with `--page-margin` around it); a value set on the host wins
 * over the ones of the widget.
 */
export function placeFeedbackWidget(
  host: HTMLElement,
  { bottomClearance, zIndex }: FeedbackWidgetPlacement
): void {
  const bottom =
    bottomClearance > 0
      ? `max(0px, calc(${bottomClearance}px - var(--page-margin)))`
      : '0'
  host.style.setProperty('--inset', `auto 0 ${bottom} auto`)
  host.style.setProperty('--z-index', String(zIndex))
}
