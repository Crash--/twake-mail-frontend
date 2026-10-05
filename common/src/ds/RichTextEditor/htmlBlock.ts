// Upstream to twake-ui: maybe, with the rest of RichTextEditor. Generic
// (nothing here knows about email): a block of foreign HTML the editor keeps
// as is.
import { Node, type CommandProps } from '@tiptap/core'
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection
} from '@tiptap/pm/state'
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
        props: {
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
