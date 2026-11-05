// Upstream to twake-ui: yes, as the theme of its dialogs. The frame the
// Figma gives every dialog of the app (Teammail 1.1): 544 px wide, a 76 px
// header (h4 title, 40 px close and back buttons in its row, 32 px
// gutters), 128 px wide buttons 8 px apart. twake-mui draws an h3 title,
// buttons sized by their label and 4 px apart. Phones keep twake-mui's
// layout.
import type { CSSObject, Theme } from '@linagora/twake-mui'

const WIDTH = 544
const GUTTER = 32
const HEADER_PADDING = 18
const NAV_BUTTON = 40
const NAV_GAP = 4
/** The title as high as the buttons beside it: a 76 px header */
const TITLE_PADDING_Y = `calc((${String(NAV_BUTTON)}px - 1.167em) / 2 + ${String(HEADER_PADDING)}px)`
// In px: `sx` reads a bare number of a padding or a margin as theme spacing
const TITLE_PADDING_SIDE = `${String(GUTTER + NAV_BUTTON + NAV_GAP)}px`

// `&&`: above twake-mui's overrides of the same parts
function frame(theme: Theme): CSSObject {
  return {
    // The small one too (480 px in twake-mui); a large one stays large
    '&&.small': { maxWidth: WIDTH },
    '&& .MuiDialogTitle-root': {
      ...(theme.typography.h4 as CSSObject),
      padding: `${TITLE_PADDING_Y} ${String(GUTTER)}px`,
      '&.dialogTitleWithClose': { paddingRight: TITLE_PADDING_SIDE },
      '&.dialogTitleWithBack': { paddingLeft: TITLE_PADDING_SIDE }
    },
    '&& .dialogIconButton': {
      top: HEADER_PADDING,
      width: NAV_BUTTON,
      height: NAV_BUTTON,
      padding: '0px'
    },
    '&& .dialogCloseButton': { right: GUTTER },
    '&& .dialogBackButton': { left: GUTTER },
    '&& .MuiDialogActions-root': {
      gap: theme.spacing(1),
      '& > :not(style) ~ :not(style)': { marginLeft: 0 },
      '& .MuiButton-root': { minWidth: 128 }
    }
  }
}

/** Paper of a dialog with a title, a content and actions (`FixedDialog`) */
export function modalDialogPaperSx(theme: Theme): CSSObject {
  return { [theme.breakpoints.up('md')]: frame(theme) }
}

/**
 * Paper of a small dialog (a short text and its actions, `ConfirmDialog`):
 * no line between the title, the text and the actions, 24 px of space
 */
export function smallDialogPaperSx(theme: Theme): CSSObject {
  return {
    [theme.breakpoints.up('md')]: {
      ...frame(theme),
      // twake-mui sizes a confirmation to its text
      '&&.small': { maxWidth: WIDTH, width: '100%' },
      '&& .MuiDialogContent-root': { paddingTop: 0 },
      '&& .dialogTitleFluidContainer': { marginBottom: '24px' }
    }
  }
}
