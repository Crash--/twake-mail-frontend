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
import { useEditorState, type Editor } from '@tiptap/react'
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type MutableRefObject
} from 'react'

import { EditorIcon, type EditorIconName } from './editorIcons'
import {
  DEFAULT_FONT_SIZE,
  type EditorActions,
  type RichTextColor,
  type RichTextEditorLabels,
  type RichTextFontSize,
  type RichTextToolbarItemId
} from './types'

type MenuName = 'color' | 'size' | 'align'

interface ToolbarItem {
  id: RichTextToolbarItemId
  icon: EditorIconName
  label: string
  /** Toggle buttons expose aria-pressed */
  pressed?: boolean
  disabled?: boolean
  menu?: MenuName
  run?: () => void
  /** What the button shows besides its icon: the size, the colour bar */
  display?: 'size' | 'color'
  /** Buttons of the same group share one bordered box */
  group?: 'format' | 'lists' | 'history' | 'insert'
}

export interface RichTextToolbarProps {
  editor: Editor
  labels: RichTextEditorLabels
  colors: readonly RichTextColor[]
  fontSizes: readonly RichTextFontSize[]
  /** Id of the editing area the toolbar controls */
  editorId: string
  onOpenLinkDialog: () => void
  /** Null when the caller does not handle images */
  onPickImages: (() => void) | null
  /** Link and image buttons in the toolbar; the caller has them elsewhere if not */
  hasInsertButtons: boolean
  /** Under the text, with a divider above, or above it */
  placement: 'top' | 'bottom'
  /** Lets the editor send the focus here (Alt+F10) */
  actionsRef: MutableRefObject<EditorActions>
  /** The editor is disabled: every button says it, and does nothing */
  disabled?: boolean
  buttonTestId?: (item: RichTextToolbarItemId) => string
}

const BOX_HEIGHT = 32
const ICON_SIZE = 16
/** What every button of the toolbar is: Inter Medium 14 in a bordered box */
const BUTTON_SX = {
  minWidth: 0,
  height: BOX_HEIGHT,
  px: 1,
  py: 0.5,
  gap: '2px',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '4px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  color: 'text.primary'
} as const
/** A button inside a group: no border of its own */
const GROUP_BUTTON_SX = {
  ...BUTTON_SX,
  width: 24,
  height: 28,
  px: 0,
  py: 0,
  border: 'none'
} as const
const GROUP_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  p: '2px',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '4px'
} as const
const ICON_SX = { fontSize: ICON_SIZE } as const

const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const
type Alignment = (typeof ALIGNMENTS)[number]

const ALIGN_ICONS: Record<Alignment, EditorIconName> = {
  left: 'alignLeft',
  center: 'alignCenter',
  right: 'alignRight',
  justify: 'alignJustify'
}

/**
 * The formatting toolbar: one tab stop, arrows (Home, End) move between the
 * buttons (roving tabindex), toggles say `aria-pressed`, every icon button
 * has an `aria-label` and the same tooltip. Disabled buttons stay
 * focusable (`aria-disabled`), as the toolbar pattern recommends.
 */
export function RichTextToolbar({
  editor,
  labels,
  colors,
  fontSizes,
  editorId,
  onOpenLinkDialog,
  onPickImages,
  hasInsertButtons,
  placement,
  actionsRef,
  disabled = false,
  buttonTestId
}: RichTextToolbarProps): ReactElement {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      blockquote: current.isActive('blockquote'),
      link: current.isActive('link'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
      color: String(current.getAttributes('textStyle').color ?? ''),
      fontSize: String(current.getAttributes('textStyle').fontSize ?? ''),
      align:
        ALIGNMENTS.find(alignment =>
          current.isActive({ textAlign: alignment })
        ) ?? 'left'
    })
  })
  const [activeIndex, setActiveIndex] = useState(0)
  const [openMenu, setOpenMenu] = useState<{
    name: MenuName
    anchor: HTMLElement
  } | null>(null)
  const sizeLabel = state.fontSize
    ? String(Number.parseInt(state.fontSize, 10))
    : String(DEFAULT_FONT_SIZE)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()

  // The order of the design: size, colour, bold to strike, alignment, lists,
  // then what the design does not show (history, links, clear)
  const allItems: ToolbarItem[] = [
    {
      id: 'size',
      icon: 'fontSize',
      label: `${labels.fontSize} ${sizeLabel}`,
      menu: 'size',
      display: 'size'
    },
    {
      id: 'color',
      icon: 'textColor',
      label: labels.textColor,
      menu: 'color',
      display: 'color'
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
      id: 'bullet-list',
      icon: 'bulletList',
      label: labels.bulletList,
      pressed: state.bulletList,
      group: 'lists',
      run: () => chain().toggleBulletList().run()
    },
    {
      id: 'ordered-list',
      icon: 'orderedList',
      label: labels.orderedList,
      pressed: state.orderedList,
      group: 'lists',
      run: () => chain().toggleOrderedList().run()
    },
    {
      id: 'blockquote',
      icon: 'blockquote',
      label: labels.blockquote,
      pressed: state.blockquote,
      group: 'lists',
      run: () => chain().toggleBlockquote().run()
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // React events bubble out of the menus' portals: only the buttons count
    if (!(event.target instanceof Node)) return
    if (!event.currentTarget.contains(event.target)) return
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
          aria-haspopup={item.menu ? 'menu' : undefined}
          aria-expanded={item.menu ? openMenu?.name === item.menu : undefined}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={handleClick(item, index)}
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
          {item.display === 'size' ? (
            <span aria-hidden="true">{sizeLabel}</span>
          ) : item.display === 'color' ? (
            <Box
              aria-hidden="true"
              className="u-flex u-flex-column u-flex-items-center"
              sx={{ gap: '2px' }}
            >
              <EditorIcon name={item.icon} sx={ICON_SX} />
              <Box
                sx={{
                  width: 10,
                  height: 2,
                  bgcolor: state.color || 'text.primary'
                }}
              />
            </Box>
          ) : (
            <EditorIcon name={item.icon} sx={ICON_SX} />
          )}
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

  return (
    <Box
      role="toolbar"
      aria-label={labels.toolbar}
      aria-controls={editorId}
      onKeyDown={handleKeyDown}
      className="u-flex u-flex-wrap u-flex-items-center"
      sx={
        placement === 'bottom'
          ? {
              flexShrink: 0,
              gap: 1,
              px: 2,
              py: 1,
              borderTop: '1px solid',
              borderColor: 'divider'
            }
          : { gap: 1, py: 0.5 }
      }
    >
      {segments.map(segment =>
        segment.isGroup ? (
          <Box key={segment.key} sx={GROUP_SX}>
            {segment.entries.map(([item, index]) => renderButton(item, index))}
          </Box>
        ) : (
          segment.entries.map(([item, index]) => renderButton(item, index))
        )
      )}

      <Menu
        anchorEl={openMenu?.anchor}
        open={openMenu?.name === 'color'}
        onClose={closeMenu}
      >
        {colors.map(color => (
          <MenuItem
            key={color.value ?? 'default'}
            role="menuitemradio"
            aria-checked={state.color === (color.value ?? '')}
            onClick={applyAndClose(() =>
              color.value === null
                ? chain().unsetColor().run()
                : chain().setColor(color.value).run()
            )}
          >
            <ListItemIcon>
              <Box
                aria-hidden="true"
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: color.value ?? 'text.primary'
                }}
              />
            </ListItemIcon>
            <ListItemText>{color.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={openMenu?.anchor}
        open={openMenu?.name === 'size'}
        onClose={closeMenu}
      >
        {fontSizes.map(size => (
          <MenuItem
            key={size.value ?? 'default'}
            role="menuitemradio"
            aria-checked={state.fontSize === (size.value ?? '')}
            onClick={applyAndClose(() =>
              size.value === null
                ? chain().unsetFontSize().run()
                : chain().setFontSize(size.value).run()
            )}
          >
            <ListItemText
              slotProps={{
                primary: { sx: { fontSize: size.value ?? undefined } }
              }}
            >
              {size.label}
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
    </Box>
  )
}
