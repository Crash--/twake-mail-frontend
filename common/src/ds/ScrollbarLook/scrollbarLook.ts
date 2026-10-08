// Upstream to twake-ui: no, the look of tmail-flutter's scroll bars
// (`ScrollbarThemeData`, `ScrollbarListView`): a 6 px grey (#C1C1C1) thumb
// rounded by 10 px, no track, shown only while the pointer is over the area
// that scrolls (the thumb of tmail-flutter's desktop shows with the pointer). Every scrolling area of the app takes it, as
// global CSS of the theme (`MuiCssBaseline`), merged in `AppProviders`.
import type { CSSObject } from '@mui/material/styles'

const THUMB_COLOR = '#C1C1C1'

/** The global CSS drawing the scroll bars of tmail-flutter */
export const SCROLLBAR_CSS: CSSObject = {
  // Firefox: a thin bar, the thumb on a transparent track. Only there:
  // Chromium follows these standard properties before the ones below, and
  // draws its own bar then, with arrow buttons at both ends
  '@supports not selector(::-webkit-scrollbar)': {
    '*': {
      scrollbarWidth: 'thin',
      scrollbarColor: 'transparent transparent'
    },
    '*:hover': { scrollbarColor: `${THUMB_COLOR} transparent` }
  },
  // Chromium and Safari: the exact 6 px rounded thumb
  '*::-webkit-scrollbar': { width: 6, height: 6 },
  '*::-webkit-scrollbar-track': { background: 'transparent' },
  '*::-webkit-scrollbar-thumb': {
    backgroundColor: 'transparent',
    borderRadius: 10
  },
  '*:hover::-webkit-scrollbar-thumb': { backgroundColor: THUMB_COLOR },
  '*::-webkit-scrollbar-corner': { background: 'transparent' },
  // No arrow buttons at the ends, as tmail-flutter
  '*::-webkit-scrollbar-button': { display: 'none' }
}
