// Upstream to twake-ui: yes, as the theme values they stand for. twake-mui
// `primary.main` (#0a84ff) and `text.secondary` (Grey 900 at 64 %) fail the
// AA contrast of RGAA 3.2 on the sidebar (docs/twake-mui-gaps.md,
// "Accessibility"); until the theme changes, the `ds/` components of the
// navigation share these two values instead of a global override.

/** Primary 600 darkened: 5.97:1 under white text, 4.69:1 on Action/selected */
export const NAV_ACCENT = '#0060C9'

/** One step darker, for the pressed or hovered accent background */
export const NAV_ACCENT_HOVER = '#0157AD'

/** Grey 900 at 80 %: 5.3:1 on the default background (`SecondaryText`) */
export const NAV_SECONDARY_TEXT = 'rgba(66, 66, 68, 0.8)'
