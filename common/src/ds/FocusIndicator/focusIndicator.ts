// Upstream to twake-ui: yes, as a theme option of `TwakeMuiThemeProvider`.
// twake-mui has no focus style of its own: each component of the app drew
// its 2 px outline, shown as well when a text field is clicked
// (docs/twake-mui-gaps.md).
import type { CSSObject, ThemeOptions } from '@mui/material/styles'

/**
 * How the keyboard focus shows. `discreet`, the default, is a thin line, and
 * nothing in a text field (its caret and border show the focus); `enhanced`
 * draws a thick outline on everything that takes the focus, for the users
 * who need to see it at a glance.
 */
export type FocusIndicator = 'discreet' | 'enhanced'

/** Width of the outline, in px */
export const FOCUS_RING_WIDTH: Record<FocusIndicator, number> = {
  discreet: 1,
  enhanced: 3
}

/**
 * The outline, for a component that draws it somewhere else than on the
 * focused element (the `::after` of a link covering its row, the wrapper of
 * a hidden input). Anywhere else the theme draws it: a component never sets
 * its own `outline` on focus.
 */
export const FOCUS_RING: CSSObject = {
  outline: 'var(--focus-ring-width) solid var(--focus-ring-color)',
  outlineOffset: 'var(--focus-ring-offset)'
}

/**
 * Draws the outline inside the element: a row filling a scrolling list,
 * whose parent would clip it
 */
export const FOCUS_RING_INSET: CSSObject = {
  '--focus-ring-offset': 'calc(-1 * var(--focus-ring-width))'
}

/**
 * Marks a region that takes the focus from a script only (the main content,
 * after a navigation or the skip link): with `tabindex="-1"`, it shows no
 * outline, as the headings that take it
 */
export const SCRIPT_FOCUS_TARGET = { 'data-focus-target': '' } as const

/** Headings and regions that take the focus from a script only */
const SCRIPT_FOCUSED =
  ':is(h1, h2, h3, h4, h5, h6, [data-focus-target])[tabindex="-1"]'

/** Rows that fill their list: the outline is drawn inside */
const INSET_ROWS =
  '.MuiMenuItem-root, .MuiListItemButton-root, .MuiTab-root, [role="treeitem"], [role="option"]'

/**
 * Fields whose caret and border show the focus: a click there shows
 * `:focus-visible` too. Enhanced, the outline of a MUI field goes around its
 * box, not its input.
 */
const TEXT_FIELDS: Record<FocusIndicator, string> = {
  discreet:
    'input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"], [type="button"], [type="submit"], [type="reset"]), textarea, select, [contenteditable="true"]',
  enhanced: '.MuiInputBase-input'
}

/**
 * The theme options of a focus indicator: one outline on whatever has the
 * keyboard focus, MUI `ButtonBase` components and native elements, set by
 * the `--focus-ring-*` custom properties a component may change (another
 * colour, drawn inside). The rule of the native elements weighs no more than
 * `:focus-visible`, so a component's own wins. The headings and regions
 * that take the focus from a script (after a route change, `tabindex="-1"`,
 * `SCRIPT_FOCUS_TARGET`) show none.
 */
export function focusIndicatorThemeOptions(
  focusIndicator: FocusIndicator
): ThemeOptions {
  return {
    components: {
      MuiCssBaseline: {
        styleOverrides: theme => ({
          ':root': {
            '--focus-ring-width': `${String(FOCUS_RING_WIDTH[focusIndicator])}px`,
            // The CSS variable of the theme follows its colour scheme
            '--focus-ring-color': theme.vars.palette.primary.main,
            '--focus-ring-offset': '2px'
          },
          [INSET_ROWS]: FOCUS_RING_INSET,
          [`:focus-visible:where(:not(${TEXT_FIELDS[focusIndicator]}, ${SCRIPT_FOCUSED}))`]:
            FOCUS_RING,
          // Nor the outline of the browser
          [`${SCRIPT_FOCUSED}:focus`]: { outline: 'none' },
          // Enhanced, a MUI field is outlined around its box
          ...(focusIndicator === 'enhanced'
            ? {
                '.MuiInputBase-root:has(> .MuiInputBase-input:focus-visible)':
                  FOCUS_RING
              }
            : {})
        })
      },
      // ButtonBase removes the outline with a class: the rule goes there
      MuiButtonBase: {
        styleOverrides: { root: { '&.Mui-focusVisible': FOCUS_RING } }
      }
    }
  }
}
