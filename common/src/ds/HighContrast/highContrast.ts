// Upstream to twake-ui: yes, as a high-contrast colour scheme of
// `TwakeMuiThemeProvider` and its forced-colours rules. twake-mui has light
// and dark only, whose greys and blue are below the RGAA 3.2 / 3.3 ratios
// on white (docs/twake-mui-gaps.md).
import type { CSSObject, ThemeOptions } from '@mui/material/styles'

/**
 * The colours of the high-contrast scheme, a light scheme: the backgrounds
 * stay (#FFFFFF and #F3F6F9), the texts, the blue, the red and the outlines
 * are darker. Ratios on #FFFFFF / #F3F6F9.
 */
export const HIGH_CONTRAST_COLORS = {
  /** Primary text, 21:1 */
  text: '#000000',
  /** Secondary text and icons, 8.3:1 / 7.6:1 */
  textSecondary: '#474F59',
  /** Placeholders, hints and outlines of the controls, 5.9:1 */
  outline: '#5C6670',
  /** Links, selected items, filled buttons (white text on it 7.5:1) */
  primary: '#0050B3',
  primaryDark: '#003C87',
  /** Fill of a selected row */
  selected: '#E0EDFF',
  /** Error texts and invalid borders, 7.3:1 */
  error: '#B00020',
  errorDark: '#8C001A',
  success: '#1B6E36',
  warning: '#8A4B00',
  info: '#00695C',
  /** The focus outline, 21:1 / 19.6:1 */
  focusRing: '#000000',
  white: '#FFFFFF'
} as const

/** Text of an input is primary: its placeholder at this opacity is 6.7:1 */
const PLACEHOLDER_OPACITY = 0.64

/** Width of the bar on the start edge of a selected row, in px */
const SELECTED_BAR_WIDTH = 4

/**
 * What the high-contrast scheme changes in the light scheme of twake-mui,
 * merged into it by `TwakeMuiThemeProvider`: the palette roles every
 * component reads, and the opacity of the placeholders
 */
export function highContrastThemeOptions(): ThemeOptions {
  const c = HIGH_CONTRAST_COLORS
  return {
    colorSchemes: {
      light: {
        palette: {
          primary: {
            main: c.primary,
            dark: c.primaryDark,
            light: c.selected,
            contrastText: c.white
          },
          secondary: { main: c.textSecondary, contrastText: c.white },
          error: { main: c.error, dark: c.errorDark, contrastText: c.white },
          success: { main: c.success, contrastText: c.white },
          warning: { main: c.warning, contrastText: c.white },
          info: { main: c.info, contrastText: c.white },
          text: {
            primary: c.text,
            secondary: c.textSecondary,
            disabled: c.outline,
            icon: c.textSecondary
          },
          border: {
            main: c.outline,
            ghost: c.outline,
            opacity: 1,
            ghostOpacity: 1
          },
          action: { active: c.textSecondary, selected: c.selected }
        },
        opacity: { inputPlaceholder: PLACEHOLDER_OPACITY }
      }
    }
  }
}

const OUTLINE = 'var(--twake-palette-border-main)'
const PRIMARY = 'var(--twake-palette-primary-main)'

const OFF_SWITCH = '.MuiSwitch-root .MuiSwitch-switchBase:not(.Mui-checked)'

/** Selected entries of the folder tree and the settings menu */
const SELECTED_ENTRIES =
  '.MuiListItemButton-root:is(.Mui-selected, .active), a[aria-current="page"]'

/**
 * The global CSS of the high-contrast scheme, for what the palette does not
 * reach: a white switched-off track with a 2 px outline and a dark thumb,
 * a border on the search field, a bar on the start edge of the selected
 * entries, and text buttons whose labels wrap rather than being cut by a
 * larger text spacing (RGAA 10.12)
 */
export const HIGH_CONTRAST_CSS: CSSObject = {
  [`${OFF_SWITCH}:not(.Mui-disabled) + .MuiSwitch-track`]: {
    backgroundColor: HIGH_CONTRAST_COLORS.white,
    boxShadow: `inset 0 0 0 2px ${OUTLINE}`
  },
  [`${OFF_SWITCH}:not(.Mui-disabled) :is(.switchThumb, .MuiSwitch-thumb)`]: {
    backgroundColor: OUTLINE
  },
  'form:has(.SearchBar-icon):not(:focus-within)': { borderColor: OUTLINE },
  [SELECTED_ENTRIES]: {
    boxShadow: `inset ${String(SELECTED_BAR_WIDTH)}px 0 0 ${PRIMARY}`
  },
  '.MuiButton-root:is(.MuiButton-text, .MuiButton-outlined)': {
    whiteSpace: 'normal',
    height: 'auto'
  }
}

/**
 * Under a forced-colours theme (Windows high contrast), in every scheme:
 * the system repaints the backgrounds, so the switches, the selected
 * entries and the filled buttons get borders and system colours, and the
 * focus outline takes the highlight colour
 */
export const FORCED_COLORS_CSS: CSSObject = {
  '@media (forced-colors: active)': {
    ':root': { '--focus-ring-color': 'Highlight' },
    '.MuiSwitch-root .MuiSwitch-track': {
      forcedColorAdjust: 'none',
      backgroundColor: 'Canvas',
      border: '1px solid ButtonText'
    },
    '.MuiSwitch-root .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
      backgroundColor: 'Highlight'
    },
    '.MuiSwitch-root .MuiSwitch-switchBase :is(.switchThumb, .MuiSwitch-thumb)':
      { forcedColorAdjust: 'none', backgroundColor: 'ButtonText' },
    '.MuiSwitch-root .MuiSwitch-switchBase.Mui-checked :is(.switchThumb, .MuiSwitch-thumb)':
      { backgroundColor: 'HighlightText' },
    [SELECTED_ENTRIES]: {
      borderInlineStart: `${String(SELECTED_BAR_WIDTH)}px solid Highlight`
    },
    '.MuiButton-contained': { border: '1px solid ButtonText' }
  }
}
