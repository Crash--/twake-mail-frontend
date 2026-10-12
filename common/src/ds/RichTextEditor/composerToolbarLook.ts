// The look of tmail-flutter's formatting toolbar of the composer
// (`ToolbarRichTextWidget`, `ArrowDownIconBorderButtonWidget`,
// `DropdownButtonFontSizeWidget`, `DropDownButtonWidget`,
// `DropDownMenuHeaderStyleWidget`), measured on tmail-flutter's web app.

/** tmail-flutter's grey of the icons (`colorDefaultRichTextButton`) */
export const COMPOSER_ICON_COLOR = '#99A2AD'
/** The colour of the text when none is picked, as tmail-flutter shows it */
export const COMPOSER_DEFAULT_TEXT_COLOR = '#222222'
const OUTLINE = '#E6E1E5'
/** The background of a box whose menu is open */
const OPEN_BACKGROUND = '#F2F3F5'

/**
 * The bar: white, 24 px from the sides, 8 px above and below, the boxes 8 px
 * apart, a soft shadow instead of a rule above
 */
export const COMPOSER_TOOLBAR_SX = {
  px: '24px',
  py: '8px',
  gap: '8px',
  bgcolor: '#FFFFFF',
  boxShadow: '0 0 24px rgba(0, 0, 0, 0.08), 0 0 2px rgba(0, 0, 0, 0.08)'
} as const

/**
 * A box opening a menu, or a lone button: 40 px high, 5 px around a 28 px
 * icon (then the 12 px arrow), outlined in #E6E1E5 and rounded by 8
 */
export const COMPOSER_BUTTON_SX = {
  minWidth: 0,
  height: 40,
  p: '5px',
  gap: 0,
  flexShrink: 0,
  border: `1px solid ${OUTLINE}`,
  borderRadius: '8px',
  color: COMPOSER_ICON_COLOR,
  '&[aria-expanded="true"]': { bgcolor: OPEN_BACKGROUND }
} as const

/** The size: a grey label in a 0.5 px outline, 4 px in */
export const COMPOSER_SIZE_BUTTON_SX = {
  ...COMPOSER_BUTTON_SX,
  p: '4px',
  gap: '4px',
  // tmail-flutter's 0.5 px #CFD7E2, as a browser draws it on a 1x screen
  border: '1px solid #E7EBF1'
} as const

export const COMPOSER_SIZE_LABEL_SX = {
  display: 'flex',
  alignItems: 'center',
  alignSelf: 'stretch',
  px: '16px',
  borderRadius: '4px',
  bgcolor: '#F4F4F4',
  color: '#ADADC0',
  fontSize: 16,
  fontWeight: 500,
  lineHeight: '20px'
} as const

/** The font: its name in black 16, 122 px wide, the arrow at the end */
export const COMPOSER_FONT_BUTTON_SX = {
  ...COMPOSER_BUTTON_SX,
  width: 122,
  pl: '12px',
  pr: '10px',
  justifyContent: 'space-between',
  border: '1px solid rgba(0, 0, 0, 0.12)',
  color: '#000000',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '20px',
  '& > span:first-of-type': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }
} as const

/** Bold to strike: one outlined box of 38 px buttons, grey, black when on */
export const COMPOSER_GROUP_SX = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  height: 40,
  boxSizing: 'border-box',
  border: `1px solid ${OUTLINE}`,
  borderRadius: '8px'
} as const

export const COMPOSER_GROUP_BUTTON_SX = {
  minWidth: 0,
  width: 38,
  height: 38,
  p: '5px',
  flexShrink: 0,
  borderRadius: '8px',
  color: COMPOSER_ICON_COLOR,
  '&[aria-pressed="true"]': { color: '#000000' }
} as const

/** The 24 px icons of the buttons tmail-flutter does not have (undo…) */
export const COMPOSER_EXTRA_ICON_SX = { fontSize: 24 } as const

/** The menus: white, rounded, 44 px entries 12 px in */
export const COMPOSER_MENU_PAPER_SX = {
  borderRadius: '5px',
  boxShadow:
    '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
} as const

// `&&` wins over the menus of the theme (ds/MenuLook)
export const COMPOSER_MENU_ITEM_SX = {
  '&&': {
    minHeight: 44,
    px: '12px',
    '& .MuiListItemText-primary': {
      fontSize: 16,
      lineHeight: '20px',
      color: '#000000'
    }
  }
} as const

/** An entry of the sizes: centred, the blue check of the current 12 px in */
export const COMPOSER_SIZE_ITEM_SX = {
  '&&': {
    minHeight: 44,
    px: '12px',
    position: 'relative',
    justifyContent: 'center',
    '& .MuiListItemText-root': { flex: '0 0 auto' },
    '& .MuiListItemText-primary': {
      fontSize: 16,
      lineHeight: '20px',
      fontWeight: 500,
      color: '#000000'
    },
    '& .RichTextToolbar-check': {
      position: 'absolute',
      insetInlineStart: 12,
      color: '#007AFF'
    }
  }
} as const

/** An entry of the fonts: 40 px, the round check of the current at the end */
export const COMPOSER_FONT_ITEM_SX = {
  '&&': {
    minHeight: 40,
    px: '12px',
    gap: '8px',
    '& .MuiListItemText-primary': {
      fontSize: 16,
      lineHeight: '20px',
      color: '#000000'
    }
  }
} as const

/** The sizes: 128 px wide, rounded by 16, centred, a check on the current */
export const COMPOSER_SIZE_MENU_PAPER_SX = {
  ...COMPOSER_MENU_PAPER_SX,
  width: 128,
  borderRadius: '16px'
} as const

/** The fonts: 200 px wide, rounded by 8, 40 px entries */
export const COMPOSER_FONT_MENU_PAPER_SX = {
  ...COMPOSER_MENU_PAPER_SX,
  width: 200,
  borderRadius: '8px'
} as const

/** tmail-flutter's order of the text styles */
export const COMPOSER_TEXT_STYLES = [
  'paragraph',
  'blockquote',
  'code',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6'
] as const

/** The text styles, each written as it looks (`HeaderStyleType`) */
export const COMPOSER_TEXT_STYLE_LOOK = {
  paragraph: { fontSize: 16, fontWeight: 400 },
  h1: { fontSize: 32, fontWeight: 700 },
  h2: { fontSize: 24, fontWeight: 700 },
  h3: { fontSize: 18, fontWeight: 700 },
  h4: { fontSize: 16, fontWeight: 700 },
  h5: { fontSize: 13, fontWeight: 700 },
  h6: { fontSize: 11, fontWeight: 700 },
  blockquote: {
    fontSize: 16,
    fontWeight: 400,
    px: '10px',
    borderLeft: '5px solid #EEEEEE'
  },
  code: {
    fontSize: 13,
    fontWeight: 400,
    px: '10px',
    py: '8px',
    flex: '1 1 auto',
    border: '1px solid #CCCCCC',
    borderRadius: '4px',
    bgcolor: '#F5F5F5'
  }
} as const
