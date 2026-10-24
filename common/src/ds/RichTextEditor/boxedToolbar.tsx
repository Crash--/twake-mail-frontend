// Upstream to twake-ui: no, the look of tmail-flutter. The `boxed` look of
// RichTextToolbar: tmail-flutter's toolbar of the signature editor
// (`ToolbarRichTextWidget` in the identity creator).
import {
  Icon,
  type IconProps,
  Link,
  List,
  Number,
  Image,
  Dropdown
} from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  FormatColorFill,
  StyleBold,
  StyleColor,
  StyleHeader,
  StyleItalic,
  StyleStrikeThrough,
  StyleUnderline
} from '@/ds/FlutterIcons/FlutterIcons'

import type { RichTextToolbarItemId } from './types'

/** tmail-flutter's text of the signature, 16 px */
export const BOXED_FONT_SIZE = 16

/**
 * The buttons of tmail-flutter's toolbar, in its order: the image first,
 * then text style, size, font, colour, highlight, bold to strike, alignment
 * and lists. The link follows the image, so that a link can be added without
 * knowing Ctrl+K (tf#3633). No history nor clearing.
 */
export const BOXED_ITEMS: readonly RichTextToolbarItemId[] = [
  'image',
  'link',
  'text-style',
  'size',
  'font',
  'color',
  'highlight',
  'bold',
  'italic',
  'underline',
  'strike',
  'align',
  'lists'
]

/**
 * The toolbar: wrapped, 8 px between the boxes and the lines, 12 px above
 * the text. Every box is 40 px high, outlined in #E6E1E5 and rounded by
 * 8 px, its icon 28 px in 5 px of padding.
 */
export const BOXED_TOOLBAR_SX = {
  flexWrap: 'wrap',
  overflowX: 'visible',
  maskImage: 'none',
  // tmail-flutter puts 8 px after every box, the last of a line too: the
  // lines break where its own do
  columnGap: 0,
  rowGap: 1,
  '& > .MuiIconButton-root, & > .RichTextToolbar-group': { mr: 1 },
  pt: 0,
  pb: '12px',
  '& .MuiIconButton-root': {
    // No 44 px touch target: tmail-flutter's boxes are 40 px everywhere
    minWidth: 0,
    minHeight: 0,
    height: 40,
    p: '5px',
    gap: 0,
    border: 1,
    borderColor: 'border.main',
    borderRadius: '8px',
    color: 'text.icon',
    bgcolor: 'transparent'
  },
  '& .MuiIconButton-root:hover': { bgcolor: 'action.hover' },
  '& .RichTextToolbar-group': {
    height: 40,
    boxSizing: 'border-box',
    gap: 0,
    p: 0,
    border: 1,
    borderColor: 'border.main',
    borderRadius: '8px'
  },
  '& .RichTextToolbar-group .MuiIconButton-root': {
    width: 38,
    height: 38,
    p: '5px',
    border: 'none'
  },
  // tmail-flutter: black when on, grey otherwise, nothing behind
  '&& .MuiIconButton-root[aria-pressed="true"]': {
    color: 'text.primary',
    bgcolor: 'transparent'
  },
  // The size: a thin #CFD7E2 outline, the number in a grey label
  '& .RichTextToolbar-size': {
    p: '4px',
    border: '0.5px solid',
    borderColor: 'border.main'
  },
  // The font: 122 px, its name in black, the arrow at the end
  '& .RichTextToolbar-font': {
    width: 122,
    justifyContent: 'space-between',
    pl: '12px',
    pr: '10px',
    borderColor: 'divider',
    bgcolor: 'background.paper'
  }
} as const

const SIZE_LABEL_SX = {
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  px: 2,
  mr: '4px',
  borderRadius: '4px',
  bgcolor: 'action.hover',
  fontSize: 16,
  fontWeight: 500,
  color: 'text.secondary'
} as const

const FONT_LABEL_SX = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 16,
  fontWeight: 400,
  color: 'text.primary'
} as const

const STYLE_ICONS: Partial<Record<RichTextToolbarItemId, IconProps['icon']>> = {
  image: Image,
  link: Link,
  'text-style': StyleHeader,
  bold: StyleBold,
  italic: StyleItalic,
  underline: StyleUnderline,
  strike: StyleStrikeThrough
}

const ALIGN_ICONS: Record<string, IconProps['icon']> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify
}

/** The class of the buttons drawn otherwise than a 40 px icon box */
export function boxedClassName(id: RichTextToolbarItemId): string | undefined {
  if (id === 'size') return 'RichTextToolbar-size'
  if (id === 'font') return 'RichTextToolbar-font'
  return undefined
}

function Arrow(): ReactElement {
  return <Icon icon={Dropdown} size={12} color={'currentColor'} />
}

export interface BoxedContentState {
  /** The size shown, e.g. "16" */
  size: string
  /** The name of the font */
  font: string
  /** The colour of the text, '' for the default (black) */
  color: string
  /** The highlight, '' for none */
  highlight: string
  align: string
  isOrderedList: boolean
}

/** What a button of the boxed toolbar shows */
export function BoxedContent({
  id,
  state
}: {
  id: RichTextToolbarItemId
  state: BoxedContentState
}): ReactElement {
  switch (id) {
    case 'size':
      return (
        <>
          <Box component="span" aria-hidden="true" sx={SIZE_LABEL_SX}>
            {state.size}
          </Box>
          <Arrow />
        </>
      )
    case 'font':
      return (
        <>
          <Box component="span" aria-hidden="true" sx={FONT_LABEL_SX}>
            {state.font}
          </Box>
          <Arrow />
        </>
      )
    case 'color':
      return (
        <>
          <Icon
            icon={StyleColor}
            size={28}
            color={state.color || 'currentColor'}
          />
          <Arrow />
        </>
      )
    case 'highlight':
      return (
        <>
          <Icon
            icon={FormatColorFill}
            size={24}
            color={state.highlight || 'currentColor'}
          />
          <Arrow />
        </>
      )
    case 'align':
      return (
        <>
          <Icon icon={ALIGN_ICONS[state.align] ?? AlignLeft} size={28} />
          <Arrow />
        </>
      )
    case 'lists':
      return (
        <>
          <Icon icon={state.isOrderedList ? Number : List} size={28} />
          <Arrow />
        </>
      )
    case 'text-style':
      return (
        <>
          <Icon icon={StyleHeader} size={28} />
          <Arrow />
        </>
      )
    default: {
      const icon = STYLE_ICONS[id]
      return icon ? <Icon icon={icon} size={28} /> : <></>
    }
  }
}
