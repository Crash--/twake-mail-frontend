// Upstream to twake-ui: with RichTextEditor. The keyboard alternative to the
// resize handles of the images (RGAA 7.1: every function works without a
// mouse).
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Popper,
  TextField,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { NodeSelection } from '@tiptap/pm/state'
import { useEditorState, type Editor } from '@tiptap/react'
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type ReactElement
} from 'react'

import { EditorIcon, type EditorIconName } from './editorIcons'
import {
  IMAGE_SIZE_PRESETS,
  type EditorActions,
  type ImageSizePreset,
  type RichTextImageItemId,
  type RichTextImageLabels
} from './types'

/** Change of width of "Smaller" and "Larger", in % of the image's own width */
const SIZE_STEP = 10
const MIN_PERCENT = 10
const MIN_WIDTH = 40

const PRESETS: readonly ImageSizePreset[] = [
  'small',
  'medium',
  'large',
  'original'
]

interface SelectedImage {
  position: number
  /** Width the image is shown at, null for its own width */
  width: number | null
  /** The alternative text, empty for a decorative image */
  alt: string
}

/** The image the selection holds, null when it holds something else */
function selectedImage(editor: Editor): SelectedImage | null {
  const { selection } = editor.state
  if (
    !(selection instanceof NodeSelection) ||
    selection.node.type.name !== 'image'
  ) {
    return null
  }
  const width = Number(selection.node.attrs.width)
  return {
    position: selection.from,
    width: Number.isFinite(width) && width > 0 ? width : null,
    alt:
      typeof selection.node.attrs.alt === 'string'
        ? selection.node.attrs.alt
        : ''
  }
}

function imageElement(
  editor: Editor,
  position: number
): HTMLImageElement | null {
  const dom = editor.view.nodeDOM(position)
  if (dom instanceof HTMLImageElement) return dom
  return dom instanceof HTMLElement ? dom.querySelector('img') : null
}

interface AltTextFieldProps {
  label: string
  help: string
  /** The alternative text of the image */
  value: string
  /** Writes it in the image, `keepSelection` when the focus goes on in the editor */
  onApply: (alt: string) => void
  onBackToText: () => void
  onBackToToolbar: () => void
  inputRef: RefObject<HTMLInputElement | null>
  'data-testid'?: string
}

/**
 * The field of the alternative text of the image (RGAA 1.1): empty means
 * decorative (`alt=""`). Enter writes it, Escape gives the old text back;
 * both return to the text of the message. Tab writes it too and goes on,
 * Shift+Tab goes back to the toolbar.
 */
function AltTextField({
  label,
  help,
  value,
  onApply,
  onBackToText,
  onBackToToolbar,
  inputRef,
  'data-testid': testId
}: AltTextFieldProps): ReactElement {
  const helpId = useId()
  const [draft, setDraft] = useState(value)
  /** Escape or a key already wrote or dropped the text: leaving writes nothing more */
  const isDone = useRef(false)

  const finish = (apply: boolean, leave: () => void): void => {
    isDone.current = true
    // The focus leaves first: writing the text remounts this field
    leave()
    if (apply && draft !== value) onApply(draft)
    if (!apply) setDraft(value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    isDone.current = false
    const key = event.key
    if (key === 'Enter') {
      finish(true, onBackToText)
    } else if (key === 'Escape') {
      finish(false, onBackToText)
    } else if (key === 'Tab') {
      finish(true, event.shiftKey ? onBackToToolbar : onBackToText)
    } else {
      return
    }
    event.preventDefault()
    // Not to the composer around the editor (Escape closes it)
    event.stopPropagation()
  }

  return (
    <>
      <TextField
        label={label}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!isDone.current && draft !== value) onApply(draft)
          isDone.current = false
        }}
        size="small"
        inputRef={inputRef}
        sx={{ minWidth: 200, flex: '1 1 200px' }}
        slotProps={{
          htmlInput: {
            'aria-describedby': helpId,
            autoComplete: 'off',
            'data-testid': testId
          }
        }}
      />
      <span id={helpId} className="u-visuallyhidden">
        {help}
      </span>
    </>
  )
}

export interface ImageToolbarProps {
  editor: Editor
  labels: RichTextImageLabels
  /** Lets the editor move the focus here (Enter on a selected image) */
  actionsRef: RefObject<EditorActions>
  'data-testid'?: string
  altInputTestId?: string
  buttonTestId?: (item: RichTextImageItemId) => string
}

/**
 * The toolbar of the selected image, next to it: sizes in % of the image's
 * own width (as the resize handles, it writes `width` and `height`),
 * smaller, larger, remove, a field for its alternative text and a status
 * line saying the size.
 *
 * Keyboard: arrows select an image in the text, Enter moves the focus here;
 * arrows (Home, End) move between the buttons; Escape or Shift+Tab go back
 * to the text, the image still selected; Tab goes to the alternative text,
 * where Enter and Escape return to the text (see `AltTextField`).
 */
export function ImageToolbar({
  editor,
  labels,
  actionsRef,
  'data-testid': testId,
  altInputTestId,
  buttonTestId
}: ImageToolbarProps): ReactElement | null {
  const image = useEditorState({
    editor,
    selector: ({ editor: current }) => selectedImage(current)
  })
  const isEditorFocused = useEditorState({
    editor,
    selector: ({ editor: current }) => current.isFocused
  })
  const [hasFocus, setHasFocus] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const altRef = useRef<HTMLInputElement>(null)

  const element = image === null ? null : imageElement(editor, image.position)
  const naturalWidth = element?.naturalWidth ?? 0
  const naturalHeight = element?.naturalHeight ?? 0
  const shownWidth = image?.width ?? (naturalWidth > 0 ? naturalWidth : null)
  const percent =
    shownWidth !== null && naturalWidth > 0
      ? Math.round((shownWidth / naturalWidth) * 100)
      : null

  const resize = (nextPercent: number): void => {
    if (image === null || naturalWidth === 0) return
    const bounded = Math.min(Math.max(nextPercent, MIN_PERCENT), 100)
    const width = Math.max(
      Math.round((naturalWidth * bounded) / 100),
      MIN_WIDTH
    )
    const height = Math.round((width * naturalHeight) / naturalWidth)
    editor
      .chain()
      .command(({ tr }) => {
        tr.setNodeAttribute(image.position, 'width', width)
        tr.setNodeAttribute(image.position, 'height', height)
        tr.setSelection(NodeSelection.create(tr.doc, image.position))
        return true
      })
      .run()
  }

  const writeAlt = (alt: string): void => {
    if (image === null) return
    // Not touching the selection: the focus may be leaving for elsewhere
    editor
      .chain()
      .command(({ tr }) => {
        tr.setNodeAttribute(image.position, 'alt', alt)
        return true
      })
      .run()
  }

  const remove = (): void => {
    editor.chain().focus().deleteSelection().run()
  }

  const items: {
    id: RichTextImageItemId
    /** Icon buttons have a tooltip; the others show their label */
    icon: EditorIconName | null
    label: string
    pressed?: boolean
    run: () => void
    separatorBefore?: boolean
  }[] = [
    ...PRESETS.map(preset => ({
      id: preset,
      icon: null,
      label: labels.sizes[preset],
      pressed: percent === IMAGE_SIZE_PRESETS[preset],
      run: () => resize(IMAGE_SIZE_PRESETS[preset])
    })),
    {
      id: 'smaller',
      icon: 'zoomOut',
      label: labels.smaller,
      separatorBefore: true,
      run: () => resize((percent ?? 100) - SIZE_STEP)
    },
    {
      id: 'larger',
      icon: 'zoomIn',
      label: labels.larger,
      run: () => resize((percent ?? 100) + SIZE_STEP)
    },
    {
      id: 'remove',
      icon: 'delete',
      label: labels.remove,
      separatorBefore: true,
      run: remove
    }
  ]

  const focusItem = (index: number): void => {
    const count = items.length
    const next = ((index % count) + count) % count
    setActiveIndex(next)
    buttonRefs.current[next]?.focus()
  }

  useLayoutEffect(() => {
    actionsRef.current.focusImageToolbar = () => {
      if (selectedImage(editor) === null) return false
      setHasFocus(true)
      const button = buttonRefs.current[activeIndex]
      if (button?.isConnected) {
        button.focus()
      } else {
        // Not shown yet: once the state says the editor or it has the focus
        requestAnimationFrame(() => {
          buttonRefs.current[activeIndex]?.focus()
        })
      }
      return true
    }
  })

  const backToText = (): void => {
    setHasFocus(false)
    editor.commands.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => focusItem(activeIndex + 1),
      ArrowLeft: () => focusItem(activeIndex - 1),
      Home: () => focusItem(0),
      End: () => focusItem(items.length - 1),
      Escape: backToText,
      Tab: event.shiftKey ? backToText : () => altRef.current?.focus()
    }
    const action = keys[event.key]
    if (action) {
      event.preventDefault()
      // Not to the composer around the editor (Escape closes it)
      event.stopPropagation()
      action()
    }
  }

  const handleClick = (run: () => void, index: number) => (): void => {
    setActiveIndex(index)
    run()
  }

  // Keep the image selected while clicking
  const keepSelection = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (
      !(event.relatedTarget instanceof Node) ||
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      setHasFocus(false)
    }
  }

  const open =
    image !== null && element !== null && (isEditorFocused || hasFocus)

  if (!open) return null

  return (
    <Popper
      open
      anchorEl={element}
      placement="bottom-start"
      // In the editor's tree: the focus trap of a dialog holding the editor
      // keeps it
      disablePortal
      sx={{ zIndex: theme => theme.zIndex.modal + 1 }}
    >
      <Paper
        elevation={4}
        onFocus={() => setHasFocus(true)}
        onBlur={handleBlur}
        className="u-flex u-flex-items-center"
        sx={{
          gap: 0.5,
          px: 0.5,
          py: 0.5,
          mt: 0.5,
          flexWrap: 'wrap',
          maxWidth: 'min(520px, 90vw)'
        }}
      >
        <Box
          role="toolbar"
          aria-label={labels.toolbar}
          onKeyDown={handleKeyDown}
          className="u-flex u-flex-items-center"
          data-testid={testId}
        >
          {items.map((item, index) => (
            <Box key={item.id} className="u-flex u-flex-items-center">
              {item.separatorBefore ? (
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              ) : null}
              {item.icon === null ? (
                <Button
                  ref={button => {
                    buttonRefs.current[index] = button
                  }}
                  size="small"
                  color="inherit"
                  aria-pressed={item.pressed}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={handleClick(item.run, index)}
                  onMouseDown={keepSelection}
                  data-testid={buttonTestId?.(item.id)}
                  sx={{
                    minWidth: 0,
                    color: item.pressed ? 'primary.main' : 'text.primary',
                    bgcolor: item.pressed ? 'action.selected' : 'transparent'
                  }}
                >
                  {item.label}
                </Button>
              ) : (
                <Tooltip title={item.label}>
                  <IconButton
                    ref={button => {
                      buttonRefs.current[index] = button
                    }}
                    size="small"
                    aria-label={item.label}
                    tabIndex={index === activeIndex ? 0 : -1}
                    onClick={handleClick(item.run, index)}
                    onMouseDown={keepSelection}
                    data-testid={buttonTestId?.(item.id)}
                    sx={{ color: 'text.secondary' }}
                  >
                    <EditorIcon name={item.icon} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
        </Box>
        <AltTextField
          // A new text when another image, or the image changed elsewhere
          key={`${image.position}:${image.alt}`}
          label={labels.alt}
          help={labels.altHelp}
          value={image.alt}
          onApply={writeAlt}
          onBackToText={backToText}
          onBackToToolbar={() => focusItem(activeIndex)}
          inputRef={altRef}
          data-testid={altInputTestId}
        />
        <Typography
          role="status"
          variant="caption"
          color="textPrimary"
          className="u-ph-half"
        >
          {shownWidth !== null && percent !== null
            ? labels.sizeStatus(shownWidth, percent)
            : ''}
        </Typography>
      </Paper>
    </Popper>
  )
}
