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
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  useId,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  useState,
  type ChangeEvent,
  type ReactElement
} from 'react'

import { cleanPastedHtml } from './cleanPastedHtml'
import { HtmlBlock, type HtmlBlockOptions } from './htmlBlock'
import { ImageToolbar } from './ImageToolbar'
import { InlineImage, type InlineImageAttributes } from './inlineImage'
import { LinkDialog, type LinkDialogValue } from './LinkDialog'
import { RichTextToolbar } from './RichTextToolbar'
import { SmartTrailingBlock } from './smartTrailingBlock'
import type {
  EditorActions,
  RichTextColor,
  RichTextEditorLabels,
  RichTextEditorTestIds,
  RichTextFontSize
} from './types'

export interface RichTextEditorProps {
  labels: RichTextEditorLabels
  /** Initial content, HTML; later changes are made through the editor */
  content: string
  colors: readonly RichTextColor[]
  fontSizes: readonly RichTextFontSize[]
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
   * Fills the height of its container (a flex column) and scrolls inside,
   * without a border: the editor of a window
   */
  fill?: boolean
  /** The editor, once created: read and change the document through it */
  onReady?: (editor: Editor) => void
  onUpdate?: (editor: Editor) => void
  testIds?: RichTextEditorTestIds
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

type ActionsRef = MutableRefObject<EditorActions>

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

function createImageFileHandler(actionsRef: ActionsRef): AnyExtension {
  const report = (error: unknown): void => console.error(error)
  return FileHandler.configure({
    allowedMimeTypes: IMAGE_TYPES,
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
export function RichTextEditor({
  labels,
  content,
  colors,
  fontSizes,
  onImageFiles,
  htmlBlock,
  footerBlockKinds = [],
  extensions = [],
  autoFocus = false,
  fill = false,
  onReady,
  onUpdate,
  testIds = {}
}: RichTextEditorProps): ReactElement {
  const editorId = useId()
  const helpId = useId()
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
        codeBlock: false,
        heading: false,
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
      TextStyleKit.configure({ fontFamily: false, lineHeight: false }),
      TextAlign.configure({ types: ['paragraph'] }),
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
      transformPastedHTML: cleanPastedHtml
    },
    onCreate: ({ editor: created }) => onReady?.(created),
    onUpdate: ({ editor: updated }) => onUpdate?.(updated)
  })

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

  return (
    // Relative: the image toolbar is placed in it
    <Box
      className="u-flex u-flex-column"
      sx={{
        position: 'relative',
        ...(fill ? { flex: '1 1 auto', minHeight: 0 } : {})
      }}
    >
      <RichTextToolbar
        editor={editor}
        labels={labels}
        colors={colors}
        fontSizes={fontSizes}
        editorId={editorId}
        onOpenLinkDialog={openLinkDialog}
        onPickImages={onImageFiles ? () => fileInputRef.current?.click() : null}
        actionsRef={actionsRef}
        buttonTestId={testIds.toolbarButton}
      />
      <ImageToolbar
        editor={editor}
        labels={labels.image}
        actionsRef={actionsRef}
        data-testid={testIds.imageToolbar}
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
            minHeight: fill ? undefined : 240,
            padding: 1.5,
            border: fill ? 'none' : '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            fontSize: 14,
            lineHeight: 1.5,
            overflowWrap: 'anywhere'
          },
          '& .ProseMirror:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: fill ? -2 : 1
          },
          '& .ProseMirror p': { margin: 0, minHeight: '1.5em' },
          '& .ProseMirror blockquote': {
            margin: '0 0 0 8px',
            paddingLeft: 1.5,
            borderLeft: '3px solid',
            borderColor: 'divider'
          },
          '& .ProseMirror img': { maxWidth: '100%', height: 'auto' },
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
