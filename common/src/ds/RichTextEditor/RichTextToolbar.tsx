// Upstream to twake-ui: yes, with RichTextEditor: an accessible formatting
// toolbar (APG toolbar pattern) in twake-mui.
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@linagora/twake-mui'
import type { Node as ProseNode } from '@tiptap/pm/model'
import { useEditorState, type Editor } from '@tiptap/react'
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type RefObject
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

import { ColorMenu } from './ColorMenu'
import { EditorIcon, type EditorIconName } from './editorIcons'
import {
  DEFAULT_FONT_SIZE,
  TEXT_STYLES,
  type EditorActions,
  type RichTextColor,
  type RichTextEditorLabels,
  type RichTextFontFamily,
  type RichTextFontSize,
  type RichTextToolbarItemId,
  type TextStyle
} from './types'

type MenuName =
  'color' | 'highlight' | 'size' | 'font' | 'text-style' | 'align' | 'lists'

interface ToolbarItem {
  id: RichTextToolbarItemId
  icon: EditorIconName
  label: string
  /** Toggle buttons expose aria-pressed */
  pressed?: boolean
  disabled?: boolean
  menu?: MenuName
  run?: () => void
  /** What the button shows besides its icon: text, a colour bar */
  display?: 'size' | 'color' | 'highlight' | 'font' | 'text-style'
  /** Buttons of the same group share one bordered box */
  group?: 'format' | 'lists' | 'history' | 'insert'
}

export interface RichTextToolbarProps {
  editor: Editor
  labels: RichTextEditorLabels
  colors: readonly RichTextColor[]
  fontSizes: readonly RichTextFontSize[]
  fontFamilies: readonly RichTextFontFamily[]
  /** Id of the editing area the toolbar controls */
  editorId: string
  onOpenLinkDialog: () => void
  /** Null when the caller does not handle images */
  onPickImages: (() => void) | null
  /** Link and image buttons in the toolbar; the caller has them elsewhere if not */
  hasInsertButtons: boolean
  /** Under the text, with a divider above, or above it */
  placement: 'top' | 'bottom'
  /**
   * `boxed`: tmail-flutter's editor of a signature, 40 px boxes rounded by
   * 8 px, a light outline, 20 px grey icons
   */
  look?: 'compact' | 'boxed'
  /** Lets the editor send the focus here (Alt+F10) */
  actionsRef: RefObject<EditorActions>
  /** The editor is disabled: every button says it, and does nothing */
  disabled?: boolean
  buttonTestId?: (item: RichTextToolbarItemId) => string
}

const BOX_HEIGHT = 32
const ICON_SIZE = 16
/**
 * What every button of the toolbar is: Inter Medium 14 in a bordered box. The
 * design draws the 1 px border inside its 8 px (4 px) padding.
 */
const BUTTON_SX = {
  minWidth: 0,
  height: BOX_HEIGHT,
  px: '7px',
  py: '3px',
  gap: '2px',
  flexShrink: 0,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '4px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  whiteSpace: 'nowrap',
  color: 'text.primary'
} as const
/** A button inside a group: no border of its own */
const GROUP_BUTTON_SX = {
  ...BUTTON_SX,
  width: 24.5,
  height: 28,
  px: 0,
  py: 0,
  border: 'none'
} as const
const GROUP_SX = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  gap: '4px',
  // 2 px with the border: 32 px high, 114 px wide for B I U S
  p: '1px',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '4px'
} as const
const ICON_SX = { fontSize: ICON_SIZE } as const

/**
 * tmail-flutter's toolbar of a signature (`ToolbarRichTextWidget`): 40 px
 * boxes rounded by 8 px, outlined in #E6E1E5, 8 px apart, the icons in
 * 20 px grey (#99A2AD), black when on; 12 px above the text
 */
const BOXED_SX = {
  gap: 1,
  pt: 0,
  pb: '12px',
  '& .MuiIconButton-root': {
    height: 40,
    px: 1,
    borderColor: '#E6E1E5',
    borderRadius: '8px',
    color: '#99A2AD',
    fontSize: 16,
    fontWeight: 400
  },
  '& .RichTextToolbar-group': {
    height: 40,
    boxSizing: 'border-box',
    px: '5px',
    borderColor: '#E6E1E5',
    borderRadius: '8px'
  },
  '& .RichTextToolbar-group .MuiIconButton-root': {
    width: 30,
    height: 30,
    px: 0
  },
  '&& .MuiIconButton-root[aria-pressed="true"]': {
    color: '#000000',
    bgcolor: 'transparent'
  },
  '& .MuiSvgIcon-root': { fontSize: 20 }
} as const

const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const
type Alignment = (typeof ALIGNMENTS)[number]

const ALIGN_ICONS: Record<Alignment, EditorIconName> = {
  left: 'alignLeft',
  center: 'alignCenter',
  right: 'alignRight',
  justify: 'alignJustify'
}

/** `"Times New Roman", serif` and `times new roman` are the same font */
function familyKey(value: string): string {
  const first = value.split(',')[0] ?? ''
  return first.replace(/["']/g, '').trim().toLowerCase()
}

/**
 * Takes the quotes off the selected blocks. `lift` cannot do it when the
 * whole document is selected, so the quotes are replaced by their content.
 */
function unwrapBlockquotes(editor: Editor): void {
  editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const { from, to } = state.selection
      const quotes: { pos: number; size: number; node: ProseNode }[] = []
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === 'blockquote') {
          quotes.push({ pos, size: node.nodeSize, node })
          return false
        }
        return true
      })
      // From the end, so that the positions before stay valid
      for (const { pos, size, node } of quotes.reverse()) {
        tr.replaceWith(pos, pos + size, node.content)
      }
      return quotes.length > 0
    })
    .run()
}

/**
 * The formatting toolbar: one tab stop, arrows (Home, End) move between the
 * buttons (roving tabindex), toggles say `aria-pressed`, menus say
 * `aria-expanded`, every icon button has an `aria-label` and the same
 * tooltip. Disabled buttons stay focusable (`aria-disabled`), as the toolbar
 * pattern recommends. On phones it is one line that scrolls sideways.
 */
export function RichTextToolbar({
  editor,
  labels,
  colors,
  fontSizes,
  fontFamilies,
  editorId,
  onOpenLinkDialog,
  onPickImages,
  hasInsertButtons,
  placement,
  look = 'compact',
  actionsRef,
  disabled = false,
  buttonTestId
}: RichTextToolbarProps): ReactElement {
  const isMobile = useScreenSize() === 'mobile'
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const textStyle = current.getAttributes('textStyle')
      const heading = TEXT_STYLES.find(
        style =>
          style.startsWith('h') &&
          current.isActive('heading', { level: Number(style.slice(1)) })
      )
      return {
        bold: current.isActive('bold'),
        italic: current.isActive('italic'),
        underline: current.isActive('underline'),
        strike: current.isActive('strike'),
        bulletList: current.isActive('bulletList'),
        orderedList: current.isActive('orderedList'),
        blockquote: current.isActive('blockquote'),
        codeBlock: current.isActive('codeBlock'),
        heading: heading ?? null,
        link: current.isActive('link'),
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
        color: String(textStyle.color ?? ''),
        backgroundColor: String(textStyle.backgroundColor ?? ''),
        fontSize: String(textStyle.fontSize ?? ''),
        fontFamily: String(textStyle.fontFamily ?? ''),
        align:
          ALIGNMENTS.find(alignment =>
            current.isActive({ textAlign: alignment })
          ) ?? 'left'
      }
    }
  })
  const [activeIndex, setActiveIndex] = useState(0)
  // On phones: is there more to scroll to on each side (the edge fades)
  const [edges, setEdges] = useState({ start: false, end: false })
  const [openMenu, setOpenMenu] = useState<{
    name: MenuName
    anchor: HTMLElement
  } | null>(null)
  const sizeLabel = state.fontSize
    ? String(Number.parseInt(state.fontSize, 10))
    : String(DEFAULT_FONT_SIZE)
  const currentFont =
    fontFamilies.find(
      family => familyKey(family.value) === familyKey(state.fontFamily)
    ) ?? fontFamilies[0]
  const currentStyle: TextStyle =
    state.heading ??
    (state.blockquote ? 'blockquote' : state.codeBlock ? 'code' : 'paragraph')
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()

  const applyTextStyle = (style: TextStyle): void => {
    if (style === 'blockquote') {
      if (!state.blockquote) chain().setBlockquote().run()
      return
    }
    if (state.blockquote) unwrapBlockquotes(editor)
    if (style === 'paragraph') {
      chain().setParagraph().run()
    } else if (style === 'code') {
      chain().setCodeBlock().run()
    } else {
      const level = Number(style.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6
      chain().setHeading({ level }).run()
    }
  }

  // The order of the design: text style, size, font, colour, highlight,
  // bold to strike, alignment, lists and indentation, then what the design
  // does not show (history, links, clear)
  const allItems: ToolbarItem[] = [
    {
      id: 'text-style',
      icon: 'fontSize',
      label: `${labels.textStyle} ${labels.textStyles[currentStyle]}`,
      menu: 'text-style',
      display: 'text-style'
    },
    {
      id: 'size',
      icon: 'fontSize',
      label: `${labels.fontSize} ${sizeLabel}`,
      menu: 'size',
      display: 'size'
    },
    {
      id: 'font',
      icon: 'fontSize',
      label: `${labels.fontFamily} ${currentFont?.label ?? ''}`,
      menu: 'font',
      display: 'font'
    },
    {
      id: 'color',
      icon: 'textColor',
      label: labels.textColor,
      menu: 'color',
      display: 'color'
    },
    {
      id: 'highlight',
      icon: 'highlight',
      label: labels.highlight,
      menu: 'highlight',
      display: 'highlight'
    },
    {
      id: 'bold',
      icon: 'bold',
      label: labels.bold,
      pressed: state.bold,
      group: 'format',
      run: () => chain().toggleBold().run()
    },
    {
      id: 'italic',
      icon: 'italic',
      label: labels.italic,
      pressed: state.italic,
      group: 'format',
      run: () => chain().toggleItalic().run()
    },
    {
      id: 'underline',
      icon: 'underline',
      label: labels.underline,
      pressed: state.underline,
      group: 'format',
      run: () => chain().toggleUnderline().run()
    },
    {
      id: 'strike',
      icon: 'strike',
      label: labels.strike,
      pressed: state.strike,
      group: 'format',
      run: () => chain().toggleStrike().run()
    },
    {
      id: 'align',
      icon: ALIGN_ICONS[state.align],
      label: labels.align,
      menu: 'align'
    },
    {
      id: 'lists',
      icon: 'bulletList',
      label: labels.lists,
      menu: 'lists'
    },
    {
      id: 'undo',
      icon: 'undo',
      label: labels.undo,
      disabled: !state.canUndo,
      group: 'history',
      run: () => chain().undo().run()
    },
    {
      id: 'redo',
      icon: 'redo',
      label: labels.redo,
      disabled: !state.canRedo,
      group: 'history',
      run: () => chain().redo().run()
    },
    ...(hasInsertButtons
      ? [
          {
            id: 'link' as const,
            icon: 'link' as const,
            label: labels.link,
            pressed: state.link,
            group: 'insert' as const,
            run: onOpenLinkDialog
          },
          ...(onPickImages
            ? [
                {
                  id: 'image' as const,
                  icon: 'image' as const,
                  label: labels.insertImage,
                  group: 'insert' as const,
                  run: onPickImages
                }
              ]
            : [])
        ]
      : []),
    {
      id: 'clear-formatting',
      icon: 'clearFormatting',
      label: labels.clearFormatting,
      run: () => chain().unsetAllMarks().unsetTextAlign().run()
    }
  ]

  const items = disabled
    ? allItems.map(item => ({ ...item, disabled: true }))
    : allItems

  const focusItem = (index: number): void => {
    const count = items.length
    const next = ((index % count) + count) % count
    setActiveIndex(next)
    buttonRefs.current[next]?.focus()
  }
  useLayoutEffect(() => {
    actionsRef.current.focusToolbar = () => {
      focusItem(activeIndex)
    }
  })

  const toolbarRef = useRef<HTMLDivElement>(null)
  const updateEdges = (): void => {
    const element = toolbarRef.current
    if (!element) return
    const start = element.scrollLeft > 1
    const end =
      element.scrollLeft + element.clientWidth < element.scrollWidth - 1
    setEdges(previous =>
      previous.start === start && previous.end === end
        ? previous
        : { start, end }
    )
  }
  useLayoutEffect(updateEdges, [isMobile, items.length])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // React events bubble out of the menus' portals: only the buttons count
    if (!event.currentTarget.contains(event.target as Node)) return
    const keys: Record<string, () => void> = {
      ArrowRight: () => focusItem(activeIndex + 1),
      ArrowLeft: () => focusItem(activeIndex - 1),
      Home: () => focusItem(0),
      End: () => focusItem(items.length - 1),
      Escape: () => editor.commands.focus()
    }
    const action = keys[event.key]
    if (action) {
      event.preventDefault()
      // Escape here means back to the text, not closing what holds it
      event.stopPropagation()
      action()
    }
  }

  const handleClick =
    (item: ToolbarItem, index: number) =>
    (event: MouseEvent<HTMLButtonElement>): void => {
      setActiveIndex(index)
      if (item.disabled) return
      if (item.menu) {
        setOpenMenu({ name: item.menu, anchor: event.currentTarget })
        return
      }
      item.run?.()
    }

  const closeMenu = (): void => {
    setOpenMenu(null)
  }
  const applyAndClose = (apply: () => void) => (): void => {
    setOpenMenu(null)
    apply()
  }

  const renderColorBar = (color: string, fallback: string): ReactElement => (
    <Box
      sx={{
        width: 10,
        height: 2,
        bgcolor: color || fallback
      }}
    />
  )

  const renderContent = (item: ToolbarItem): ReactElement => {
    switch (item.display) {
      case 'size':
        return <span aria-hidden="true">{sizeLabel}</span>
      case 'font':
        return <span aria-hidden="true">{currentFont?.label}</span>
      case 'text-style':
        return <span aria-hidden="true">Aa</span>
      case 'color':
      case 'highlight':
        return (
          <Box
            aria-hidden="true"
            className="u-flex u-flex-column u-flex-items-center"
            sx={{ gap: '2px' }}
          >
            <EditorIcon
              name={item.icon}
              sx={item.display === 'highlight' ? { fontSize: 14 } : ICON_SX}
            />
            {item.display === 'color'
              ? renderColorBar(state.color, 'currentColor')
              : renderColorBar(state.backgroundColor, 'transparent')}
          </Box>
        )
      default:
        return <EditorIcon name={item.icon} sx={ICON_SX} />
    }
  }

  const renderButton = (item: ToolbarItem, index: number): ReactElement => {
    const isGrouped = item.group !== undefined
    return (
      <Tooltip key={item.id} title={item.label}>
        <IconButton
          ref={element => {
            buttonRefs.current[index] = element
          }}
          size="small"
          aria-label={item.label}
          aria-pressed={item.pressed}
          aria-disabled={item.disabled ? true : undefined}
          aria-haspopup={
            item.menu
              ? item.menu === 'color' || item.menu === 'highlight'
                ? 'dialog'
                : 'menu'
              : undefined
          }
          aria-expanded={item.menu ? openMenu?.name === item.menu : undefined}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={handleClick(item, index)}
          onFocus={() => setActiveIndex(index)}
          // Keep the editor selection while clicking
          onMouseDown={event => event.preventDefault()}
          data-testid={buttonTestId?.(item.id)}
          sx={{
            ...(isGrouped ? GROUP_BUTTON_SX : BUTTON_SX),
            opacity: item.disabled ? 0.4 : 1,
            ...(item.pressed
              ? { color: 'primary.main', bgcolor: 'action.selected' }
              : {})
          }}
        >
          {renderContent(item)}
        </IconButton>
      </Tooltip>
    )
  }

  // Consecutive buttons of a group share one bordered box
  const segments: {
    key: string
    isGroup: boolean
    entries: [ToolbarItem, number][]
  }[] = []
  items.forEach((item, index) => {
    const last = segments[segments.length - 1]
    if (item.group !== undefined && last?.key === item.group) {
      last.entries.push([item, index])
    } else {
      segments.push({
        key: item.group ?? item.id,
        isGroup: item.group !== undefined,
        entries: [[item, index]]
      })
    }
  })

  const testIdOf = (id: RichTextToolbarItemId): string | undefined =>
    buttonTestId?.(id)

  return (
    <Box
      role="toolbar"
      aria-label={labels.toolbar}
      aria-controls={editorId}
      onKeyDown={handleKeyDown}
      ref={toolbarRef}
      onScroll={updateEdges}
      className="u-flex u-flex-items-center"
      sx={{
        flexShrink: 0,
        gap: 1,
        ...(placement === 'bottom'
          ? {
              px: 2,
              // 40 px high under a 1 px rule, as in the design
              py: 0.5,
              borderTop: '1px solid',
              borderColor: 'divider'
            }
          : { py: 0.5 }),
        ...(isMobile
          ? {
              // One line that scrolls sideways, edges faded, no scrollbar
              flexWrap: 'nowrap',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollPaddingInline: 16,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              '& > *': { scrollSnapAlign: 'start' },
              maskImage: `linear-gradient(to right, ${
                edges.start ? 'transparent 0, #000 24px' : '#000 0'
              }, ${edges.end ? '#000 calc(100% - 24px), transparent 100%' : '#000 100%'})`
            }
          : { flexWrap: 'wrap' }),
        ...(look === 'boxed' ? BOXED_SX : {})
      }}
    >
      {segments.map(segment =>
        segment.isGroup ? (
          <Box
            key={segment.key}
            className="RichTextToolbar-group"
            sx={GROUP_SX}
          >
            {segment.entries.map(([item, index]) => renderButton(item, index))}
          </Box>
        ) : (
          segment.entries.map(([item, index]) => renderButton(item, index))
        )
      )}

      <Menu
        anchorEl={openMenu?.anchor}
        open={openMenu?.name === 'text-style'}
        onClose={closeMenu}
      >
        {TEXT_STYLES.map(style => (
          <MenuItem
            key={style}
            role="menuitemradio"
            aria-checked={currentStyle === style}
            onClick={applyAndClose(() => applyTextStyle(style))}
            data-testid={
              style === 'blockquote' ? testIdOf('blockquote') : undefined
            }
          >
            <ListItemText
              slotProps={{
                primary: {
                  sx: {
                    fontWeight: style.startsWith('h') ? 700 : undefined,
                    fontFamily: style === 'code' ? 'monospace' : undefined,
                    fontStyle: style === 'blockquote' ? 'italic' : undefined
                  }
                }
              }}
            >
              {labels.textStyles[style]}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <ColorMenu
        anchor={openMenu?.name === 'color' ? openMenu.anchor : null}
        title={labels.textColor}
        colors={colors}
        value={state.color}
        customLabel={labels.customColor}
        onPick={color => {
          if (color === null) chain().unsetColor().run()
          else chain().setColor(color).run()
        }}
        onClose={() => {
          closeMenu()
          editor.commands.focus()
        }}
        data-testid="rich-text-color-menu"
      />

      <ColorMenu
        anchor={openMenu?.name === 'highlight' ? openMenu.anchor : null}
        title={labels.highlight}
        colors={colors.map(color =>
          color.value === null ? { ...color, label: labels.noHighlight } : color
        )}
        value={state.backgroundColor}
        customLabel={labels.customColor}
        onPick={color => {
          if (color === null) chain().unsetBackgroundColor().run()
          else chain().setBackgroundColor(color).run()
        }}
        onClose={() => {
          closeMenu()
          editor.commands.focus()
        }}
        data-testid="rich-text-highlight-menu"
      />

      <Menu
        anchorEl={openMenu?.anchor}
        open={openMenu?.name === 'size'}
        onClose={closeMenu}
      >
        {fontSizes.map(size => (
          <MenuItem
            key={size.value ?? 'default'}
            role="menuitemradio"
            aria-checked={
              (state.fontSize || `${DEFAULT_FONT_SIZE}px`) ===
              (size.value ?? `${DEFAULT_FONT_SIZE}px`)
            }
            onClick={applyAndClose(() =>
              size.value === null
                ? chain().unsetFontSize().run()
                : chain().setFontSize(size.value).run()
            )}
          >
            <ListItemText>{size.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={openMenu?.anchor}
        open={openMenu?.name === 'font'}
        onClose={closeMenu}
      >
        {fontFamilies.map(family => (
          <MenuItem
            key={family.value}
            role="menuitemradio"
            aria-checked={currentFont?.value === family.value}
            onClick={applyAndClose(() =>
              chain().setFontFamily(family.value).run()
            )}
          >
            <ListItemText
              slotProps={{ primary: { sx: { fontFamily: family.value } } }}
            >
              {family.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={openMenu?.anchor}
        open={openMenu?.name === 'align'}
        onClose={closeMenu}
      >
        {ALIGNMENTS.map(alignment => (
          <MenuItem
            key={alignment}
            role="menuitemradio"
            aria-checked={state.align === alignment}
            onClick={applyAndClose(() => chain().setTextAlign(alignment).run())}
          >
            <ListItemIcon>
              <EditorIcon name={ALIGN_ICONS[alignment]} />
            </ListItemIcon>
            <ListItemText>{labels.alignments[alignment]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={openMenu?.anchor}
        open={openMenu?.name === 'lists'}
        onClose={closeMenu}
      >
        <MenuItem
          role="menuitemcheckbox"
          aria-checked={state.bulletList}
          onClick={applyAndClose(() => chain().toggleBulletList().run())}
          data-testid={testIdOf('bullet-list')}
        >
          <ListItemIcon>
            <EditorIcon name="bulletList" />
          </ListItemIcon>
          <ListItemText>{labels.bulletList}</ListItemText>
        </MenuItem>
        <MenuItem
          role="menuitemcheckbox"
          aria-checked={state.orderedList}
          onClick={applyAndClose(() => chain().toggleOrderedList().run())}
          data-testid={testIdOf('ordered-list')}
        >
          <ListItemIcon>
            <EditorIcon name="orderedList" />
          </ListItemIcon>
          <ListItemText>{labels.orderedList}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={applyAndClose(() => {
            const inList = state.bulletList || state.orderedList
            if (inList && chain().sinkListItem('listItem').run()) return
            chain().indentBlocks().run()
          })}
          data-testid={testIdOf('indent')}
        >
          <ListItemIcon>
            <EditorIcon name="indent" />
          </ListItemIcon>
          <ListItemText>{labels.indent}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={applyAndClose(() => {
            const inList = state.bulletList || state.orderedList
            if (inList && chain().liftListItem('listItem').run()) return
            chain().outdentBlocks().run()
          })}
          data-testid={testIdOf('outdent')}
        >
          <ListItemIcon>
            <EditorIcon name="outdent" />
          </ListItemIcon>
          <ListItemText>{labels.outdent}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  )
}
