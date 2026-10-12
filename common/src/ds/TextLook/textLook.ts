// Upstream to twake-ui: maybe, the text of tmail-flutter, drawn by its canvas
// without font hinting and with a static Inter. Chromium on Linux hints the
// variable Inter: its glyphs snap to whole pixels, unevenly spaced and
// heavier ("re ady"), and its optical size narrows the text above 14 px.
// Global CSS of the theme (`MuiCssBaseline`), merged in `AppProviders`.
import type { CSSObject } from '@mui/material/styles'

/** The global CSS drawing the text as tmail-flutter */
export const TEXT_LOOK_CSS: CSSObject = {
  // Form controls do not inherit `text-rendering` from the page
  'html, button, input, textarea, select': {
    textRendering: 'geometricPrecision',
    fontOpticalSizing: 'none'
  }
}
