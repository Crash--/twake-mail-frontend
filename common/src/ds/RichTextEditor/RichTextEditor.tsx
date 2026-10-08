// Upstream to twake-ui: yes. twake-mui has no rich text editor; this one is
// TipTap (MIT) dressed in twake-mui, accessible (RGAA), and knows nothing
// about email: images, quoted content and signatures arrive through props
// and generic extensions (InlineImage, HtmlBlock).
import { Box } from '@linagora/twake-mui'
import { Extension, type AnyExtension } from '@tiptap/core'
import FileHandler from '@tiptap/extension-file-handler'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import type { EditorView } from '@tiptap/pm/view'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type RefObject,
  type Ref,
  useState,
  type ChangeEvent,
  type ReactElement
} from 'react'

import { FOCUS_RING_INSET } from '@/ds/FocusIndicator/focusIndicator'

import { cleanPastedHtml } from './cleanPastedHtml'
import { HtmlBlock, type HtmlBlockOptions } from './htmlBlock'
import { ImageToolbar } from './ImageToolbar'
import { Indent } from './indent'
import { InlineImage, type InlineImageAttributes } from './inlineImage'
import { LinkDialog, type LinkDialogValue } from './LinkDialog'
import { RichTextToolbar } from './RichTextToolbar'
import { SelectionAction } from './SelectionAction'
import { SmartTrailingBlock } from './smartTrailingBlock'
import {
  DEFAULT_FONT_SIZE,
  type EditorActions,
  type RichTextColor,
  type RichTextEditorActions,
  type RichTextEditorLabels,
  type RichTextEditorTestIds,
  type RichTextFontFamily,
  type RichTextFontSize,
  type RichTextSelectionAction
} from './types'

export interface RichTextEditorProps {
  labels: RichTextEditorLabels
  /** Initial content, HTML; later changes are made through the editor */
  content: string
  colors: readonly RichTextColor[]
  fontSizes: readonly RichTextFontSize[]
  /** The fonts of the font menu; the first one is the default */
  fontFamilies: readonly RichTextFontFamily[]
  /**
   * Stores image files (resizing, uploading…) and says how to show them.
   * Called for the toolbar button, paste and drop. Without it, the editor
   * takes no image file.
   */
  onImageFiles?: (files: File[]) => Promise<InlineImageAttributes[]>
  /** How HtmlBlock nodes render (frame document, titles, edit button) */
  htmlBlock?: Partial<HtmlBlockOptions>
  /**
   * Kinds of the HtmlBlocks that end the message (signature, quote): the
   * user writes above them (see SmartTrailingBlock)
   */
  footerBlockKinds?: readonly string[]
  /** More TipTap extensions (tables…) */
  extensions?: AnyExtension[]
  /** Puts the caret at the start once created (a new message, a reply) */
  autoFocus?: boolean
  /**
   * Not editable, and shown so: the text cannot change, the editing area
   * says `aria-disabled`, the toolbar buttons stay in the tab order with
   * `aria-disabled`. The content is kept for when it is enabled again
   */
  disabled?: boolean
  /**
   * Fills the height of its container (a flex column) and scrolls inside,
   * without a border: the editor of a window
   */
  fill?: boolean
  /**
   * `boxed`: tmail-flutter's editor of a signature, the toolbar of 40 px
   * boxes and a 189 px text, in one frame rounded by 10 px
   */
  look?: 'compact' | 'boxed'
  /** The formatting toolbar under the text, behind a divider; above it if false */
  isToolbarBelow?: boolean
  /** Shows the toolbar; the parent can hide it (a button of its own) */
  isToolbarShown?: boolean
  /**
   * Link and image buttons in the toolbar. A parent that has them elsewhere
   * (the footer of the composer) sets it to false and uses `actions`
   */
  hasInsertButtons?: boolean
  /** Lets the parent open the link dialog and the image picker */
  actions?: Ref<RichTextEditorActions>
  /** The editor, once created: read and change the document through it */
  onReady?: (editor: Editor) => void
  onUpdate?: (editor: Editor) => void
  testIds?: RichTextEditorTestIds
  /** A button under the end of the selected text */
  selectionAction?: RichTextSelectionAction
}

/** The image types the editor takes (paste, drop, toolbar) */
export const IMAGE_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
]

type ActionsRef = RefObject<EditorActions>

async function insertImages(
  actionsRef: ActionsRef,
  editor: Editor,
  files: File[],
  position: number | null
): Promise<void> {
  const store = actionsRef.current.storeImages
  if (!store) return
  const images = await store(files)
  const nodes = images.map(attributes => ({
    type: 'image',
    attrs: { ...attributes }
  }))
  if (position === null) {
    editor.chain().focus().insertContent(nodes).run()
  } else {
    editor.chain().focus().insertContentAt(position, nodes).run()
  }
}

function createKeyboardExtension(actionsRef: ActionsRef): AnyExtension {
  return Extension.create({
    name: 'richTextKeyboard',
    // Before the lists' Enter: on a selected image, Enter opens its toolbar
    priority: 1000,
    addKeyboardShortcuts() {
      return {
        'Mod-k': () => {
          actionsRef.current.openLinkDialog()
          return true
        },
        // Escape is left to what holds the editor (a dialog closes)
        Enter: () => actionsRef.current.focusImageToolbar(),
        'Alt-F10': () => {
          actionsRef.current.focusToolbar()
          return true
        }
      }
    }
  })
}

/**
 * ProseMirror calls `preventDefault()` on every Escape no key binding took,
 * and what holds the editor (a window, a dialog) ignores a handled Escape.
 * The key bindings still get it first; an Escape none of them takes goes up
 * untouched.
 */
function leaveEscapeToContainer(
  view: EditorView,
  event: KeyboardEvent
): boolean {
  if (event.key !== 'Escape' || event.isComposing) return false
  const isTaken = view.someProp('handleKeyDown', handle => handle(view, event))
  if (isTaken === true) event.preventDefault()
  // Keeps ProseMirror's own keydown handling away from this Escape
  return true
}

function createImageFileHandler(actionsRef: ActionsRef): AnyExtension {
  const report = (error: unknown): void => console.error(error)
  return FileHandler.configure({
    allowedMimeTypes: [...IMAGE_TYPES],
    onPaste: (editor, files) => {
      void insertImages(actionsRef, editor, files, null).catch(report)
    },
    onDrop: (editor, files, position) => {
      void insertImages(actionsRef, editor, files, position).catch(report)
    }
  })
}

/**
 * A rich text editor with its toolbar.
 *
 * Keyboard: Tab leaves the editor (in a list, it indents the item first;
 * Shift+Tab outdents), Alt+F10 goes to the toolbar and Escape comes back,
 * Ctrl/Cmd+K opens the link dialog, Ctrl+Shift+V pastes as plain text.
 * Arrows select an image in the text and Enter opens its toolbar (sizes,
 * removal: the keyboard alternative to the resize handles). Escape in the
 * text is not handled: it reaches what holds the editor. The editing area
 * is a `textbox` (`aria-multiline`) named by `labels.editor`, the help is
 * read through `aria-describedby`.
 */
/**
 * The frame of the `boxed` look: a light outline rounded by 10 px holding
 * the toolbar and a 189 px text without border of its own
 */
const BOXED_FRAME_SX = {
  border: '1px solid #E6E1E5',
  borderRadius: '10px',
  pt: '4px',
  px: 1,
  pb: 1,
  '&& .ProseMirror': {
    border: 'none',
    minHeight: 189,
    height: 189,
    overflowY: 'auto',
    boxSizing: 'border-box',
    px: '10px',
    py: 1,
    fontSize: 16,
    color: '#000000'
  }
} as const

export function RichTextEditor({
  labels,
  content,
  colors,
  fontSizes,
  fontFamilies,
  onImageFiles,
  htmlBlock,
  footerBlockKinds = [],
  extensions = [],
  autoFocus = false,
  disabled = false,
  fill = false,
  look = 'compact',
  isToolbarBelow = false,
  isToolbarShown = true,
  hasInsertButtons = true,
  actions,
  onReady,
  onUpdate,
  testIds = {},
  selectionAction
}: RichTextEditorProps): ReactElement {
  const editorId = useId()
  const helpId = useId()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [linkDialog, setLinkDialog] = useState<{
    value: LinkDialogValue
    canRemove: boolean
  } | null>(null)
  const actionsRef = useRef<EditorActions>({
    openLinkDialog: () => undefined,
    focusToolbar: () => undefined,
    focusImageToolbar: () => false,
    storeImages: null
  })
  useLayoutEffect(() => {
    actionsRef.current.storeImages = onImageFiles ?? null
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        code: false,
        horizontalRule: false,
        // No paragraph always trailing the document: nothing is written
        // after a signature or a quote by accident. SmartTrailingBlock
        // gives one above them on demand, and the gap cursor still lets the
        // user type between them on purpose
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https'
        }
      }),
      TextStyleKit.configure({ lineHeight: false }),
      TextAlign.configure({ types: ['paragraph', 'heading'] }),
      Indent,
      // Tables pasted from a spreadsheet or a page keep their cells
      TableKit.configure({ table: { resizable: false } }),
      InlineImage,
      HtmlBlock.configure(htmlBlock ?? {}),
      SmartTrailingBlock.configure({
        isFooter: node =>
          node.type.name === HtmlBlock.name &&
          footerBlockKinds.includes(String(node.attrs.kind))
      }),
      // The extensions read the ref in event handlers only, never while
      // rendering: the compiler cannot see it through the TipTap options
      // eslint-disable-next-line react-hooks/refs
      createKeyboardExtension(actionsRef),
      // eslint-disable-next-line react-hooks/refs
      ...(onImageFiles ? [createImageFileHandler(actionsRef)] : []),
      ...extensions
    ],
    content,
    editable: !disabled,
    autofocus: autoFocus ? 'start' : false,
    editorProps: {
      attributes: {
        id: editorId,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': labels.editor,
        'aria-describedby': helpId,
        ...(testIds.editor ? { 'data-testid': testIds.editor } : {})
      },
      transformPastedHTML: cleanPastedHtml,
      handleDOMEvents: { keydown: leaveEscapeToContainer }
    },
    onUpdate: ({ editor: updated }) => onUpdate?.(updated)
  })

  // Hands over the live editor: in development StrictMode creates one, destroys
  // it and creates another, and `onCreate` would leave the caller the destroyed one
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  })
  useEffect(() => {
    if (!editor.isDestroyed) onReadyRef.current?.(editor)
  }, [editor])

  // ProseMirror drops `contenteditable`; the role needs the state said
  useEffect(() => {
    if (editor.isDestroyed) return
    if (editor.isEditable === disabled) editor.setEditable(!disabled, false)
    const area = editor.view.dom
    if (disabled) {
      area.setAttribute('aria-disabled', 'true')
    } else {
      area.removeAttribute('aria-disabled')
    }
  }, [editor, disabled])

  const openLinkDialog = (): void => {
    const { from, to } = editor.state.selection
    const href = String(editor.getAttributes('link').href ?? '')
    setLinkDialog({
      value: { text: editor.state.doc.textBetween(from, to, ' '), url: href },
      canRemove: href !== ''
    })
  }
  useLayoutEffect(() => {
    actionsRef.current.openLinkDialog = openLinkDialog
  })

  useImperativeHandle(
    actions,
    () => ({
      openLinkDialog: () => {
        openLinkDialog()
      },
      pickImages: () => {
        if (!onImageFiles) return false
        fileInputRef.current?.click()
        return true
      },
      insertText: text => {
        editor.chain().focus().insertContent(text).run()
      },
      focus: () => {
        editor.commands.focus()
      }
    }),
    // The dialog reads the editor when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, onImageFiles]
  )

  const closeLinkDialog = (): void => {
    setLinkDialog(null)
    editor.commands.focus()
  }

  const applyLink = ({ text, url }: LinkDialogValue): void => {
    setLinkDialog(null)
    const { from, to, empty } = editor.state.selection
    const selected = editor.state.doc.textBetween(from, to, ' ')
    const chain = editor.chain().focus().extendMarkRange('link')
    if (empty || (text !== '' && text !== selected)) {
      chain
        .insertContent({
          type: 'text',
          text: text === '' ? url : text,
          marks: [{ type: 'link', attrs: { href: url } }]
        })
        .run()
    } else {
      chain.setLink({ href: url }).run()
    }
  }

  const removeLink = (): void => {
    setLinkDialog(null)
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    void insertImages(actionsRef, editor, files, null).catch((error: unknown) =>
      console.error(error)
    )
  }

  const toolbar = isToolbarShown ? (
    <RichTextToolbar
      editor={editor}
      labels={labels}
      colors={colors}
      fontSizes={fontSizes}
      fontFamilies={fontFamilies}
      editorId={editorId}
      onOpenLinkDialog={openLinkDialog}
      onPickImages={onImageFiles ? () => fileInputRef.current?.click() : null}
      hasInsertButtons={hasInsertButtons}
      placement={isToolbarBelow ? 'bottom' : 'top'}
      look={look}
      actionsRef={actionsRef}
      disabled={disabled}
      buttonTestId={testIds.toolbarButton}
    />
  ) : null

  return (
    // Relative: the image toolbar is placed in it
    <Box
      ref={setContainer}
      className="u-flex u-flex-column"
      sx={{
        position: 'relative',
        ...(fill ? { flex: '1 1 auto', minHeight: 0 } : {}),
        ...(look === 'boxed' ? BOXED_FRAME_SX : {})
      }}
    >
      {isToolbarBelow ? null : toolbar}
      <ImageToolbar
        editor={editor}
        labels={labels.image}
        actionsRef={actionsRef}
        data-testid={testIds.imageToolbar}
        altInputTestId={testIds.imageAltInput}
        buttonTestId={testIds.imageButton}
      />
      <Box
        id={helpId}
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)'
        }}
      >
        {labels.keyboardHelp}
      </Box>
      <Box
        sx={{
          ...(fill
            ? {
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                '& > div, & .ProseMirror': { minHeight: '100%' }
              }
            : {}),
          '& .ProseMirror': {
            // Filling a window, the outline of the focus is drawn inside
            ...(fill ? FOCUS_RING_INSET : { '--focus-ring-offset': '1px' }),
            minHeight: fill ? undefined : 240,
            // The body of a window, as tmail-flutter's editor: 16 px above,
            // 25 px at the sides, Inter Regular in dark grey (#222222)
            padding: fill ? '16px 25px' : 1.5,
            border: fill ? 'none' : '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            fontSize: DEFAULT_FONT_SIZE,
            ...(fill
              ? {
                  fontWeight: 400,
                  lineHeight: '18.4px',
                  letterSpacing: 0,
                  color: '#222222'
                }
              : { lineHeight: 1.5 }),
            overflowWrap: 'anywhere'
          },
          // Greyed as the other disabled fields of twake-mui
          '& .ProseMirror[contenteditable="false"]': {
            bgcolor: 'action.disabledBackground',
            color: 'text.secondary',
            cursor: 'default'
          },
          // A long draft (a quoted thread, big tables) has thousands of nodes: the blocks
          // out of view are not laid out nor painted at each key (docs/perf/composer.md).
          // `auto` keeps their text reachable by find and by assistive technologies
          '& .ProseMirror > *': {
            contentVisibility: 'auto',
            containIntrinsicSize: 'auto 300px'
          },
          '& .ProseMirror p': {
            margin: 0,
            minHeight: fill ? '18.4px' : '1.5em'
          },
          '& .ProseMirror h1, & .ProseMirror h2, & .ProseMirror h3, & .ProseMirror h4, & .ProseMirror h5, & .ProseMirror h6':
            { margin: 0, lineHeight: 1.3 },
          '& .ProseMirror h1': { fontSize: '2em' },
          '& .ProseMirror h2': { fontSize: '1.5em' },
          '& .ProseMirror h3': { fontSize: '1.17em' },
          '& .ProseMirror h4': { fontSize: '1em' },
          '& .ProseMirror h5': { fontSize: '0.83em' },
          '& .ProseMirror h6': { fontSize: '0.67em' },
          '& .ProseMirror pre': {
            margin: 0,
            padding: 1,
            fontFamily: 'monospace',
            fontSize: '0.9em',
            bgcolor: 'action.hover',
            borderRadius: 0.5,
            whiteSpace: 'pre-wrap'
          },
          '& .ProseMirror blockquote': {
            margin: '0 0 0 8px',
            paddingLeft: 1.5,
            borderLeft: '3px solid',
            borderColor: 'divider'
          },
          '& .ProseMirror img': { maxWidth: '100%', height: 'auto' },
          // TipTap gives the resize handles of an image no size: corner
          // squares, shown on the image hovered or selected
          '& .ProseMirror [data-resize-handle]': {
            width: 12,
            height: 12,
            margin: '-6px',
            bgcolor: 'primary.main',
            border: '2px solid',
            borderColor: 'background.paper',
            borderRadius: '2px',
            opacity: 0,
            zIndex: 1
          },
          '& .ProseMirror [data-resize-handle="bottom-right"]': {
            cursor: 'nwse-resize'
          },
          '& .ProseMirror [data-resize-handle="bottom-left"]': {
            cursor: 'nesw-resize'
          },
          '& .ProseMirror [data-resize-container]:hover [data-resize-handle], & .ProseMirror .ProseMirror-selectednode [data-resize-handle], & .ProseMirror [data-resize-container].ProseMirror-selectednode [data-resize-handle]':
            { opacity: 1 },
          '& .ProseMirror a': { color: 'primary.main' },
          '& .ProseMirror table': { borderCollapse: 'collapse' },
          '& .ProseMirror td, & .ProseMirror th': {
            border: '1px solid',
            borderColor: 'divider',
            padding: 0.5
          }
        }}
      >
        <EditorContent editor={editor} />
      </Box>
      {selectionAction ? (
        <SelectionAction
          editor={editor}
          action={selectionAction}
          container={container}
        />
      ) : null}
      {isToolbarBelow ? toolbar : null}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        multiple
        hidden
        onChange={handleFiles}
      />
      <LinkDialog
        open={linkDialog !== null}
        labels={labels.linkDialog}
        initialValue={linkDialog?.value ?? { text: '', url: '' }}
        canRemove={linkDialog?.canRemove ?? false}
        onApply={applyLink}
        onRemove={removeLink}
        onClose={closeLinkDialog}
        textInputTestId={testIds.linkTextInput}
        urlInputTestId={testIds.linkUrlInput}
        applyButtonTestId={testIds.linkApplyButton}
      />
    </Box>
  )
}
