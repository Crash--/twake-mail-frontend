// Upstream to twake-ui: maybe, with the rest of RichTextEditor. Generic
// (nothing here knows about email): a block of foreign HTML the editor keeps
// as is.
import { Node, type CommandProps } from '@tiptap/core'
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection
} from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { HtmlBlockView } from './HtmlBlockView'

/**
 * How a block shows in the editor: `frame` isolates it in a sandboxed
 * iframe (its own stylesheets cannot leak into the app), `inline` renders it
 * in the page (small, trusted-after-sanitizing snippets).
 */
export type HtmlBlockDisplay = 'frame' | 'inline'

export interface HtmlBlockOptions {
  /** The whole document of the frame showing `html` (CSP, base styles…) */
  buildFrameDocument: (html: string) => string
  /** Title of the frame, for screen readers, by block kind */
  frameTitle: (kind: string) => string
  /** Label of the button that turns the block into editable content, null for none */
  editLabel: (kind: string) => string | null
  /** `data-testid` of that button */
  editTestId: (kind: string) => string | undefined
  /**
   * Label of the pill folding and unfolding an `inline` block (a signature:
   * "Signature"), null for a block without one. The block then shows as a
   * card under the pill.
   */
  toggleLabel: (kind: string) => string | null
  /** `data-testid` of that pill */
  toggleTestId: (kind: string) => string | undefined
  /**
   * The editable HTML of a block the user unwraps (image URLs to display,
   * content to block…), sanitized; the block's own HTML by default
   */
  editableHtml: (kind: string, html: string) => string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    htmlBlock: {
      /** Inserts a block of foreign HTML, which must already be sanitized */
      insertHtmlBlock: (attributes: {
        html: string
        kind: string
        display?: HtmlBlockDisplay
      }) => ReturnType
      /** Replaces the block at `position` by its HTML parsed into editable content */
      unwrapHtmlBlock: (position: number) => ReturnType
    }
  }
}

export const HTML_BLOCK_ATTRIBUTE = 'data-html-block'

function buildBlockElement(kind: string, html: string): HTMLElement {
  const element = document.createElement('div')
  element.setAttribute(HTML_BLOCK_ATTRIBUTE, kind)
  element.innerHTML = html
  return element
}

/**
 * Moves a collapsed caret left in the editor root, between two top-level
 * blocks, into the nearest text block (the one above first). WebKit puts it
 * there after a tap on the non-editable view of a block: ProseMirror maps
 * it to a text position but leaves the DOM caret where it is when that
 * position is already selected, and typing then scrambles the text ("abc"
 * comes out as "bca").
 */
function moveRootCaretIntoText(view: EditorView): void {
  const domSelection = view.dom.ownerDocument.getSelection()
  if (
    !view.editable ||
    !domSelection?.isCollapsed ||
    domSelection.anchorNode !== view.dom ||
    !view.hasFocus()
  ) {
    return
  }
  const { selection } = view.state
  // A gap cursor stands between two blocks on purpose, and a range (a
  // selected block, the whole text) must not collapse
  if (!(selection instanceof TextSelection) || !selection.empty) return
  const $position = view.state.doc.resolve(
    view.posAtDOM(view.dom, domSelection.anchorOffset)
  )
  const target =
    Selection.findFrom($position, -1, true) ??
    Selection.findFrom($position, 1, true)
  if (!target) return
  if (!selection.eq(target)) view.dispatch(view.state.tr.setSelection(target))
  const { node, offset } = view.domAtPos(target.head)
  domSelection.collapse(node, offset)
}

/**
 * An atom node holding HTML that the editor schema would otherwise rewrite:
 * a quoted email (tables, layouts, styles), a signature. ProseMirror never
 * parses its content, so it comes out exactly as it went in, wrapped in a
 * `<div data-html-block="<kind>">` that parses back to the same node.
 *
 * The HTML is trusted: sanitize it before inserting it.
 */
export const HtmlBlock = Node.create<HtmlBlockOptions>({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addOptions() {
    return {
      buildFrameDocument: (html: string) => html,
      frameTitle: (kind: string) => kind,
      editLabel: () => null,
      editTestId: () => undefined,
      toggleLabel: () => null,
      toggleTestId: () => undefined,
      editableHtml: (_kind: string, html: string) => html
    }
  },

  addAttributes() {
    return {
      html: { default: '', rendered: false },
      kind: { default: 'block', rendered: false },
      display: { default: 'frame', rendered: false }
    }
  },

  parseHTML() {
    return [
      {
        tag: `div[${HTML_BLOCK_ATTRIBUTE}]`,
        // Before paragraphs, tables and lists eat its children
        priority: 1000,
        getAttrs: element => ({
          html: element.innerHTML,
          kind: element.getAttribute(HTML_BLOCK_ATTRIBUTE) ?? 'block',
          display: element.getAttribute('data-html-block-display') ?? 'frame'
        })
      }
    ]
  },

  renderHTML({ node }) {
    const element = buildBlockElement(
      String(node.attrs.kind),
      String(node.attrs.html)
    )
    if (node.attrs.display === 'inline') {
      element.setAttribute('data-html-block-display', 'inline')
    }
    return element
  },

  addNodeView() {
    return ReactNodeViewRenderer(HtmlBlockView)
  },

  addProseMirrorPlugins() {
    const name = this.name
    return [
      new Plugin({
        key: new PluginKey('htmlBlockTyping'),
        // On every selection change (the tap) and again before a key
        // writes anything, in case WebKit put the caret back in the root.
        // The document of the editor, maybe not this one (the overlay of
        // TwakeSpace)
        view: editorView => {
          const { ownerDocument } = editorView.dom
          const handleSelectionChange = (): void => {
            moveRootCaretIntoText(editorView)
          }
          ownerDocument.addEventListener(
            'selectionchange',
            handleSelectionChange
          )
          return {
            destroy: () => {
              ownerDocument.removeEventListener(
                'selectionchange',
                handleSelectionChange
              )
            }
          }
        },
        props: {
          handleDOMEvents: {
            keydown: view => {
              moveRootCaretIntoText(view)
              return false
            }
          },
          // Typing on a selected block writes above it instead of
          // replacing it: a click on a quote must not lose the quote.
          // Delete and Backspace still remove it (and undo brings it back).
          handleTextInput(view, _from, _to, text) {
            const { selection } = view.state
            if (
              !(selection instanceof NodeSelection) ||
              selection.node.type.name !== name
            ) {
              return false
            }
            const paragraph = view.state.schema.nodes.paragraph
            if (!paragraph) return false
            const position = selection.from
            const tr = view.state.tr.insert(
              position,
              paragraph.create(null, view.state.schema.text(text))
            )
            tr.setSelection(
              TextSelection.create(tr.doc, position + 1 + text.length)
            )
            view.dispatch(tr.scrollIntoView())
            return true
          }
        }
      })
    ]
  },

  addCommands() {
    return {
      insertHtmlBlock:
        attributes =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
      unwrapHtmlBlock:
        position =>
        ({ state, commands }: CommandProps) => {
          const node = state.doc.nodeAt(position)
          if (node?.type.name !== this.name) return false
          return commands.insertContentAt(
            { from: position, to: position + node.nodeSize },
            this.options.editableHtml(
              String(node.attrs.kind),
              String(node.attrs.html)
            )
          )
        }
    }
  }
})
