// Upstream to twake-ui: with RichTextEditor.
import type { NodeViewRenderer } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/** What the editor needs to show an image and find it again at export time */
export interface InlineImageAttributes {
  /** What the browser displays: an object URL while composing */
  src: string
  alt: string | null
  /** Opaque reference the caller maps back to its stored file (a Content-ID for emails) */
  reference: string | null
  width: number | null
}

/**
 * The Image extension, inline in the text flow, with a `data-reference`
 * attribute that survives `getHTML()` and parsing: the caller swaps `src`
 * for its own URL scheme (`cid:`) on export, and back on load.
 *
 * Its size follows `width` and `height` whoever changes them: TipTap's
 * resizable view only shows the sizes its own handles set, not the ones the
 * image toolbar writes.
 */
export const InlineImage = Image.extend({
  addNodeView() {
    const parent: NodeViewRenderer | null | undefined = this.parent?.()
    if (!parent) return null
    return props => {
      const view = parent(props)
      const update = view.update?.bind(view)
      const showSize = (node: ProseMirrorNode): void => {
        const image =
          view.dom instanceof HTMLElement ? view.dom.querySelector('img') : null
        if (!image) return
        const width = Number(node.attrs.width)
        const height = Number(node.attrs.height)
        image.style.width = width > 0 ? `${width}px` : ''
        image.style.height = height > 0 ? `${height}px` : ''
      }
      view.update = (node, decorations, innerDecorations) => {
        const updated = update
          ? update(node, decorations, innerDecorations)
          : false
        if (updated) showSize(node)
        return updated
      }
      return view
    }
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      reference: {
        default: null,
        parseHTML: element => element.getAttribute('data-reference'),
        renderHTML: attributes =>
          attributes.reference
            ? { 'data-reference': String(attributes.reference) }
            : {}
      }
    }
  }
}).configure({
  inline: true,
  allowBase64: true,
  resize: {
    enabled: true,
    directions: ['bottom-right', 'bottom-left'],
    minWidth: 40,
    minHeight: 40,
    alwaysPreserveAspectRatio: true
  }
})
