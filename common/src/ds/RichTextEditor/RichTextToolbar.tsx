// Upstream to twake-ui: yes, with RichTextEditor: an accessible formatting
// toolbar (APG toolbar pattern) in twake-mui.
import {
  Box,
  Divider,
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
import type {
  EditorActions,
  RichTextColor,
  RichTextEditorLabels,
  RichTextFontSize,
  RichTextToolbarItemId
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
  separatorBefore?: boolean
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
  /** Lets the editor send the focus back here (Escape) */
  actionsRef: MutableRefObject<EditorActions>
  buttonTestId?: (item: RichTextToolbarItemId) => string
}

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
  actionsRef,
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
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()

  const items: ToolbarItem[] = [
    {
      id: 'undo',
      icon: 'undo',
      label: labels.undo,
      disabled: !state.canUndo,
      run: () => chain().undo().run()
    },
    {
      id: 'redo',
      icon: 'redo',
      label: labels.redo,
      disabled: !state.canRedo,
      run: () => chain().redo().run()
    },
    {
      id: 'bold',
      icon: 'bold',
      label: labels.bold,
      pressed: state.bold,
      separatorBefore: true,
      run: () => chain().toggleBold().run()
    },
    {
      id: 'italic',
      icon: 'italic',
      label: labels.italic,
      pressed: state.italic,
      run: () => chain().toggleItalic().run()
    },
    {
      id: 'underline',
      icon: 'underline',
      label: labels.underline,
      pressed: state.underline,
      run: () => chain().toggleUnderline().run()
    },
    {
      id: 'strike',
      icon: 'strike',
      label: labels.strike,
      pressed: state.strike,
      run: () => chain().toggleStrike().run()
    },
    {
      id: 'color',
      icon: 'textColor',
      label: labels.textColor,
      menu: 'color',
      separatorBefore: true
    },
    { id: 'size', icon: 'fontSize', label: labels.fontSize, menu: 'size' },
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
      separatorBefore: true,
      run: () => chain().toggleBulletList().run()
    },
    {
      id: 'ordered-list',
      icon: 'orderedList',
      label: labels.orderedList,
      pressed: state.orderedList,
      run: () => chain().toggleOrderedList().run()
    },
    {
      id: 'blockquote',
      icon: 'blockquote',
      label: labels.blockquote,
      pressed: state.blockquote,
      run: () => chain().toggleBlockquote().run()
    },
    {
      id: 'link',
      icon: 'link',
      label: labels.link,
      pressed: state.link,
      separatorBefore: true,
      run: onOpenLinkDialog
    },
    ...(onPickImages
      ? [
          {
            id: 'image' as const,
            icon: 'image' as const,
            label: labels.insertImage,
            run: onPickImages
          }
        ]
      : []),
    {
      id: 'clear-formatting',
      icon: 'clearFormatting',
      label: labels.clearFormatting,
      separatorBefore: true,
      run: () => chain().unsetAllMarks().unsetTextAlign().run()
    }
  ]

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

  return (
    <Box
      role="toolbar"
      aria-label={labels.toolbar}
      aria-controls={editorId}
      onKeyDown={handleKeyDown}
      className="u-flex u-flex-wrap u-flex-items-center"
      sx={{ gap: 0.25, py: 0.5 }}
    >
      {items.map((item, index) => (
        <Box key={item.id} className="u-flex u-flex-items-center">
          {item.separatorBefore ? (
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          ) : null}
          <Tooltip title={item.label}>
            <IconButton
              ref={element => {
                buttonRefs.current[index] = element
              }}
              size="small"
              aria-label={item.label}
              aria-pressed={item.pressed}
              aria-disabled={item.disabled ? true : undefined}
              aria-haspopup={item.menu ? 'menu' : undefined}
              aria-expanded={
                item.menu ? openMenu?.name === item.menu : undefined
              }
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={handleClick(item, index)}
              // Keep the editor selection while clicking
              onMouseDown={event => event.preventDefault()}
              data-testid={buttonTestId?.(item.id)}
              sx={{
                opacity: item.disabled ? 0.4 : 1,
                color: item.pressed ? 'primary.main' : 'text.secondary',
                bgcolor: item.pressed ? 'action.selected' : 'transparent'
              }}
            >
              <EditorIcon
                name={item.icon}
                sx={
                  item.id === 'color' && state.color
                    ? { borderBottom: '3px solid', borderColor: state.color }
                    : undefined
                }
              />
            </IconButton>
          </Tooltip>
        </Box>
      ))}

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
